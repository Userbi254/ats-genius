import React, { useState, useEffect } from 'react';
import { Job, CVData } from '@/types/job';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Download, Plus, X, Sparkles, FileUser, Save, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUserProfile, UserProfile } from '@/hooks/useUserProfile';
import { toast } from 'sonner';
import { supabase } from "@/integrations/supabase/client";

interface CVGeneratorProps {
  selectedJob?: Job;
  cvData: CVData;
  onUpdate: (data: CVData) => void;
  onGenerate: (cv: CVData) => void;
  showJobContext?: boolean;
  showOptimizeButton?: boolean;
  children?: React.ReactNode;
}

export function CVGenerator({
  selectedJob,
  cvData,
  onUpdate,
  onGenerate,
  showJobContext = true,
  showOptimizeButton = true,
  children
}: CVGeneratorProps) {
  const { profile, saveProfile, hasProfile } = useUserProfile();
  const [isGenerating, setIsGenerating] = useState(false);
  const [newSkill, setNewSkill] = useState('');
  const [hasOptimized, setHasOptimized] = useState<string | null>(null);
  const [optimizationReport, setOptimizationReport] = useState<any[]>([]);

  // Load saved profile on mount or when selectedJob changes
  useEffect(() => {
    if (hasProfile && hasOptimized !== selectedJob?.id) {
      // Only merge if we haven't optimized for this job yet
      // And if the current data is empty/default
      const isDefault = !cvData.fullName && !cvData.email;

      if (isDefault) {
        const initialData = {
          ...cvData,
          fullName: profile.fullName || cvData.fullName,
          email: profile.email || cvData.email,
          phone: profile.phone || cvData.phone,
          location: profile.location || cvData.location,
          summary: profile.summary || cvData.summary,
          skills: profile.skills.length > 0 ? [...new Set([...profile.skills, ...(selectedJob?.skills_needed || [])])] : cvData.skills,
          experience: profile.experience.length > 0 ? profile.experience : cvData.experience,
          education: profile.education.length > 0 ? profile.education : cvData.education,
        };
        onUpdate(initialData);
      }
    }
  }, [hasProfile, profile, selectedJob?.id, hasOptimized]);

  const saveCurrentProfile = () => {
    saveProfile({
      fullName: cvData.fullName,
      email: cvData.email,
      phone: cvData.phone,
      location: cvData.location,
      summary: cvData.summary,
      skills: cvData.skills,
      experience: cvData.experience,
      education: cvData.education,
    });
    toast.success('Profile saved');
  };

  const addSkill = () => {
    if (newSkill.trim() && !cvData.skills.includes(newSkill.trim())) {
      onUpdate({
        ...cvData,
        skills: [...cvData.skills, newSkill.trim()]
      });
      setNewSkill('');
    }
  };

  const removeSkill = (skill: string) => {
    onUpdate({
      ...cvData,
      skills: cvData.skills.filter(s => s !== skill)
    });
  };

  const addExperience = () => {
    onUpdate({
      ...cvData,
      experience: [...cvData.experience, { title: '', company: '', duration: '', description: '' }]
    });
  };

  const removeExperience = (index: number) => {
    onUpdate({
      ...cvData,
      experience: cvData.experience.filter((_, i) => i !== index)
    });
  };

  const updateExperience = (index: number, field: keyof CVData['experience'][0], value: string) => {
    onUpdate({
      ...cvData,
      experience: cvData.experience.map((exp, i) =>
        i === index ? { ...exp, [field]: value } : exp
      )
    });
  };

  const addEducation = () => {
    onUpdate({
      ...cvData,
      education: [...cvData.education, { degree: '', institution: '', year: '' }]
    });
  };

  const removeEducation = (index: number) => {
    onUpdate({
      ...cvData,
      education: cvData.education.filter((_, i) => i !== index)
    });
  };

  const updateEducation = (index: number, field: keyof CVData['education'][0], value: string) => {
    onUpdate({
      ...cvData,
      education: cvData.education.map((edu, i) =>
        i === index ? { ...edu, [field]: value } : edu
      )
    });
  };

  const optimizeCV = async () => {
    if (!selectedJob) return;

    setIsGenerating(true);
    try {
      // Use supabase.functions.invoke which automatically handles authentication
      const jobDescLen = selectedJob.description?.length || 0;
      toast.info(`Optimizing CV for: ${selectedJob.job_name}`);

      console.log('Invoking generate-cv function:', {
        jobTitle: selectedJob.job_name,
        jobCompany: selectedJob.company
      });

      const { data, error } = await supabase.functions.invoke('generate-cv', {
        body: {
          userProfile: {
            full_name: cvData.fullName,
            email: cvData.email,
            phone: cvData.phone,
            location: cvData.location,
            skills: cvData.skills,
            experience: cvData.experience,
            education: cvData.education,
            summary: cvData.summary
          },
          job: selectedJob
        }
      });

      if (error) {
        throw new Error(`Function error: ${error.message}`);
      }

      console.log('Received data:', data);

      if (data.success && data.data) {
        const generated = data.data;

        // Only update if we got valid data back
        const newSummary = generated.summary && generated.summary.length > 10 ? generated.summary : cvData.summary;
        const newSkills = Array.isArray(generated.skills) && generated.skills.length > 0 ? generated.skills : cvData.skills;

        const newExperience = Array.isArray(generated.experience) && generated.experience.length > 0
          ? generated.experience.map((exp: any) => ({
            title: exp.title || '',
            company: exp.company || '',
            duration: exp.period || exp.duration || '',
            description: Array.isArray(exp.achievements) ? exp.achievements.join('\n') : (exp.description || '')
          }))
          : cvData.experience;

        const newEducation = Array.isArray(generated.education) && generated.education.length > 0
          ? generated.education.map((edu: any) => ({
            degree: edu.degree || '',
            institution: edu.institution || '',
            year: edu.year || ''
          }))
          : cvData.education;

        onUpdate({
          ...cvData,
          summary: newSummary,
          skills: newSkills,
          experience: newExperience,
          education: newEducation
        });

        if (generated.optimization_report && Array.isArray(generated.optimization_report)) {
          setOptimizationReport(generated.optimization_report);
        }

        setHasOptimized(selectedJob.id);
        toast.success("CV optimized for the job!");
      } else {
        toast.error(data.error || "Failed to optimize CV");
      }
    } catch (error) {
      console.error('Optimization error:', error);
      toast.error(`An error occurred while optimizing CV: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="space-y-8">
      {/* Saved Profile Indicator */}
      {hasProfile && (
        <div className="glass-panel p-4 border-l-4 border-primary">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileUser className="w-5 h-5 text-primary" />
              <span className="font-medium">Saved Profile Loaded</span>
            </div>
            <Button variant="ghost" size="sm" onClick={saveCurrentProfile}>
              <Save className="w-4 h-4 mr-2" />
              Update Profile
            </Button>
          </div>
        </div>
      )}

      {/* Job Context */}
      {showJobContext && selectedJob && (
        <div className="glass-panel p-6 border-l-4 border-success">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-sm text-muted-foreground mb-1">Tailoring CV for:</p>
              <h3 className="text-xl font-semibold">{selectedJob.job_name}</h3>
              <p className="text-muted-foreground">{selectedJob.company}</p>
            </div>
            <div className="flex flex-col items-end gap-2">
              <Badge variant="secondary" className="text-success border-success/30">
                {selectedJob.relevance_score}% Match
              </Badge>
              {showOptimizeButton && (
                <Button
                  size="sm"
                  variant="default"
                  onClick={optimizeCV}
                  disabled={isGenerating}
                  className="gap-2"
                >
                  {isGenerating ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Sparkles className="w-4 h-4" />
                  )}
                  {isGenerating ? 'Optimizing...' : 'AI Optimize CV'}
                </Button>
              )}
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <span className="text-sm text-muted-foreground">Required skills:</span>
            {selectedJob.skills_needed.map((skill, i) => (
              <Badge key={i} variant="outline" className="text-xs">
                {skill}
              </Badge>
            ))}
          </div>
        </div>
      )}

      {/* Optimization Report */}
      {
        optimizationReport.length > 0 && (
          <div className="glass-panel p-6 border-l-4 border-blue-500">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-blue-500" />
              Optimization Report
            </h3>
            <div className="space-y-4">
              {optimizationReport.map((item, idx) => (
                <div key={idx} className="bg-muted/30 p-3 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm text-blue-600">{item.field}</span>
                    <span className="text-xs text-muted-foreground">{item.change}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{item.reason}</p>
                </div>
              ))}
            </div>
          </div>
        )
      }

      {/* Personal Information */}
      <div className="glass-panel p-6">
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FileUser className="w-5 h-5" />
          Personal Information
        </h3>
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="fullName">Full Name</Label>
            <Input
              id="fullName"
              value={cvData.fullName}
              onChange={e => onUpdate({ ...cvData, fullName: e.target.value })}
              placeholder="John Kamau"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={cvData.email}
              onChange={e => onUpdate({ ...cvData, email: e.target.value })}
              placeholder="john@example.com"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">Phone</Label>
            <Input
              id="phone"
              value={cvData.phone}
              onChange={e => onUpdate({ ...cvData, phone: e.target.value })}
              placeholder="+254 700 000 000"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="location">Location</Label>
            <Input
              id="location"
              value={cvData.location}
              onChange={e => onUpdate({ ...cvData, location: e.target.value })}
              placeholder="Nairobi, Kenya"
            />
          </div>
        </div>
      </div>

      {/* Professional Summary */}
      <div className="glass-panel p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Professional Summary</h3>
        </div>
        <Textarea
          value={cvData.summary}
          onChange={e => onUpdate({ ...cvData, summary: e.target.value })}
          placeholder="Write a brief professional summary..."
          className="min-h-[100px]"
        />
      </div>

      {/* Skills */}
      <div className="glass-panel p-6">
        <h3 className="text-lg font-semibold mb-4">Skills</h3>
        <div className="flex flex-wrap gap-2 mb-4">
          {cvData.skills.map((skill, i) => (
            <Badge
              key={i}
              variant="secondary"
              className="cursor-pointer hover:bg-destructive/20 transition-colors"
              onClick={() => removeSkill(skill)}
            >
              {skill}
              <X className="w-3 h-3 ml-1" />
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={newSkill}
            onChange={e => setNewSkill(e.target.value)}
            placeholder="Add a skill..."
            onKeyDown={e => e.key === 'Enter' && addSkill()}
          />
          <Button onClick={addSkill}>
            <Plus className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Experience */}
      <div className="glass-panel p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Work Experience</h3>
          <Button size="sm" variant="secondary" onClick={addExperience}>
            <Plus className="w-4 h-4 mr-2" />
            Add Experience
          </Button>
        </div>
        <div className="space-y-6">
          {cvData.experience.map((exp, index) => (
            <div key={index} className="p-4 bg-muted/30 rounded-lg space-y-3 relative">
              {cvData.experience.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 text-muted-foreground hover:text-destructive"
                  onClick={() => removeExperience(index)}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Job Title</Label>
                  <Input
                    value={exp.title}
                    onChange={e => updateExperience(index, 'title', e.target.value)}
                    placeholder="Data Annotation Specialist"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Company</Label>
                  <Input
                    value={exp.company}
                    onChange={e => updateExperience(index, 'company', e.target.value)}
                    placeholder="Sama"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Duration</Label>
                <Input
                  value={exp.duration}
                  onChange={e => updateExperience(index, 'duration', e.target.value)}
                  placeholder="Jan 2024 - Present"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea
                  value={exp.description}
                  onChange={e => updateExperience(index, 'description', e.target.value)}
                  placeholder="Describe your responsibilities..."
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Education */}
      <div className="glass-panel p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Education</h3>
          <Button size="sm" variant="secondary" onClick={addEducation}>
            <Plus className="w-4 h-4 mr-2" />
            Add Education
          </Button>
        </div>
        <div className="space-y-4">
          {cvData.education.map((edu, index) => (
            <div key={index} className="p-4 bg-muted/30 rounded-lg relative">
              {cvData.education.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="absolute top-2 right-2 text-muted-foreground hover:text-destructive"
                  onClick={() => removeEducation(index)}
                >
                  <X className="w-4 h-4" />
                </Button>
              )}
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>Degree</Label>
                  <Input
                    value={edu.degree}
                    onChange={e => updateEducation(index, 'degree', e.target.value)}
                    placeholder="Bachelor's in Computer Science"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Institution</Label>
                  <Input
                    value={edu.institution}
                    onChange={e => updateEducation(index, 'institution', e.target.value)}
                    placeholder="University of Nairobi"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Year</Label>
                  <Input
                    value={edu.year}
                    onChange={e => updateEducation(index, 'year', e.target.value)}
                    placeholder="2020"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Action Buttons */}
      {children ? (
        children
      ) : (
        <div className="flex gap-4">
          <Button
            size="lg"
            className="flex-1"
            onClick={() => onGenerate({ ...cvData, selectedJob })}
          >
            <Download className="w-5 h-5 mr-2" />
            Generate & Preview
          </Button>
          <Button
            size="lg"
            variant="secondary"
            onClick={saveCurrentProfile}
          >
            <Save className="w-5 h-5 mr-2" />
            Save Profile
          </Button>
        </div>
      )}
    </div >
  );
}
