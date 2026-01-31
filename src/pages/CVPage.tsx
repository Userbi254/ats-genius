import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { CVGenerator } from '@/components/cv/CVGenerator';
import { CVPreview } from '@/components/cv/CVPreview';
import { CVUploader } from '@/components/cv/CVUploader';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { CVData, Job } from '@/types/job';
import { generatePDF } from '@/utils/pdfGenerator';
import { FileUser, Eye, FileText, Building, ChevronRight, Briefcase, Upload, Download, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from 'sonner';

export default function CVPage() {
  const location = useLocation();
  const passedJob = location.state?.selectedJob as Job | undefined;

  const [selectedJob, setSelectedJob] = useState<Job | undefined>(passedJob);
  const [activeTab, setActiveTab] = useState<string>('upload');
  const [availableJobs, setAvailableJobs] = useState<Job[]>([]);

  const [isUploaded, setIsUploaded] = useState(false);

  // Lifted state for CV Data
  const [cvData, setCVData] = useState<CVData>({
    fullName: '',
    email: '',
    phone: '',
    location: 'Nairobi, Kenya',
    summary: '',
    skills: [],
    experience: [{ title: '', company: '', duration: '', description: '' }],
    education: [{ degree: '', institution: '', year: '' }],
    selectedJob: passedJob
  });

  useEffect(() => {
    const fetchAvailableJobs = async () => {
      try {
        const { data, error } = await supabase
          .from('workflow_runs')
          .select('extracted_jobs, sorted_jobs')
          .not('extracted_jobs', 'is', null)
          .order('started_at', { ascending: false })
          .limit(50);

        if (error) {
          console.error('Error fetching jobs:', error);
          return;
        }

        if (data) {
          console.log('[CV] Fetched workflow runs:', data.length);

          // Flatten all extracted and sorted jobs
          const allJobs: Job[] = [];
          const timestamp = Date.now();

          data.forEach((run, runIndex) => {
            // Add sorted jobs if available (they have relevance scores)
            if (run.sorted_jobs && Array.isArray(run.sorted_jobs)) {
              allJobs.push(...run.sorted_jobs.map((job: any, jobIndex: number) => ({
                ...job,
                id: `sorted-${timestamp}-r${runIndex}-j${jobIndex}`,
                originalId: job.id,
                skills_needed: job.skills_needed || [],
                requirements: job.requirements || [],
                employment_details: job.employment_details || []
              })));
            }
            // Also add extracted jobs
            else if (run.extracted_jobs && Array.isArray(run.extracted_jobs)) {
              allJobs.push(...run.extracted_jobs.map((job: any, jobIndex: number) => ({
                ...job,
                id: `extracted-${timestamp}-r${runIndex}-j${jobIndex}`,
                originalId: job.id,
                skills_needed: job.skills_needed || [],
                requirements: job.requirements || [],
                employment_details: job.employment_details || []
              })));
            }
          });

          console.log('[CV] Total jobs found:', allJobs.length);
          setAvailableJobs(allJobs);

          // If no job passed but we have jobs, select the first one
          if (!passedJob && allJobs.length > 0) {
            setSelectedJob(allJobs[0]);
          }
        }
      } catch (error) {
        console.error('Failed to fetch available jobs:', error);
      }
    };

    fetchAvailableJobs();
  }, [passedJob]);

  // Update cvData when selectedJob changes
  useEffect(() => {
    if (selectedJob) {
      setCVData(prev => ({
        ...prev,
        selectedJob: selectedJob,
        // Add job skills if not already present
        skills: prev.skills.length > 0
          ? [...new Set([...prev.skills, ...(selectedJob.skills_needed || [])])]
          : (selectedJob.skills_needed || [])
      }));
    }
  }, [selectedJob]);

  const handleJobSelect = (jobId: string) => {
    const job = availableJobs.find(j => j.id === jobId);
    if (job) {
      setSelectedJob(job);
    }
  };

  const handleProfileExtracted = (profile: any) => {
    // Completely replace the CV data with the new extraction
    // We only preserve the selectedJob if it exists in the current state
    setCVData({
      fullName: profile.fullName || '',
      email: profile.email || '',
      phone: profile.phone || '',
      location: profile.location || 'Nairobi, Kenya',
      summary: profile.summary || '',
      skills: profile.skills || [],
      experience: profile.experience || [{ title: '', company: '', duration: '', description: '' }],
      education: profile.education || [{ degree: '', institution: '', year: '' }],
      selectedJob: selectedJob
    });

    setIsUploaded(true);
    toast.success("CV uploaded! Review the details below.");
  };

  const handleGenerate = (cv: CVData) => {
    setCVData(cv);
    setActiveTab('preview');
    toast.success("CV generated! Previewing...");
  };

  const handleDownload = () => {
    generatePDF(cvData);
    toast.success("Downloading PDF...");
  };

  return (
    <DashboardLayout>
      <div className="space-y-8 animate-fade-in">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">CV Generator</h1>
            <p className="text-muted-foreground mt-1">
              Create tailored resumes for AI training positions
            </p>
          </div>

          {/* Job Selection Dropdown */}
          <div className="w-full md:w-[300px]">
            <label className="text-sm font-medium mb-1.5 block text-muted-foreground">
              Target Job
            </label>
            <Select
              value={selectedJob?.id || ""}
              onValueChange={handleJobSelect}
            >
              <SelectTrigger className="w-full bg-background">
                <SelectValue placeholder="Select a job..." />
              </SelectTrigger>
              <SelectContent>
                {availableJobs.map((job) => (
                  <SelectItem key={job.id} value={job.id}>
                    <div className="flex flex-col items-start text-left">
                      <span className="font-medium">{job.job_name}</span>
                      <span className="text-xs text-muted-foreground">{job.company || 'Unknown Company'}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Selected Job Details (Collapsible/Summary) */}
        {selectedJob && (
          <div className="glass-panel p-4 border-l-4 border-l-primary">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="font-semibold text-lg flex items-center gap-2">
                  <Briefcase className="w-4 h-4 text-primary" />
                  {selectedJob.job_name}
                </h3>
                <div className="flex flex-wrap gap-2 mt-2">
                  <Badge variant="secondary" className="text-xs">
                    {selectedJob.company || 'Unknown Company'}
                  </Badge>
                  {selectedJob.amount && (
                    <Badge variant="outline" className="text-xs text-success border-success/30">
                      {selectedJob.amount}
                    </Badge>
                  )}
                  {selectedJob.relevance_score && (
                    <Badge variant="outline" className="text-xs">
                      {selectedJob.relevance_score}% Match
                    </Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 4 Tabs: Upload, Generate, Preview, Download */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="glass-panel p-1 grid grid-cols-4 w-full max-w-2xl">
            <TabsTrigger value="upload" className="flex items-center gap-2">
              <Upload className="w-4 h-4" />
              Upload
            </TabsTrigger>
            <TabsTrigger value="generate" className="flex items-center gap-2" disabled={!isUploaded}>
              <Sparkles className="w-4 h-4" />
              Generate
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex items-center gap-2" disabled={!isUploaded}>
              <Eye className="w-4 h-4" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="download" className="flex items-center gap-2" disabled={!isUploaded}>
              <Download className="w-4 h-4" />
              Download
            </TabsTrigger>
          </TabsList>

          {/* 1. Upload Tab */}
          <TabsContent value="upload" className="mt-0 animate-fade-in">
            <div className="glass-panel p-6">
              <h2 className="text-xl font-semibold mb-4">Step 1: Upload Your CV</h2>
              <p className="text-muted-foreground mb-6">
                Upload your existing CV (PDF, DOCX, or TXT) to extract your profile information.
              </p>

              {!isUploaded ? (
                <CVUploader onProfileExtracted={handleProfileExtracted} />
              ) : (
                <div className="space-y-6">
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-4 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-green-500/20 flex items-center justify-center">
                        <FileUser className="w-4 h-4 text-green-500" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-green-500">CV Parsed Successfully</h3>
                        <p className="text-xs text-muted-foreground">Review your details below before generating.</p>
                      </div>
                    </div>
                  </div>

                  {/* Show full form in review mode */}
                  <CVGenerator
                    selectedJob={selectedJob}
                    cvData={cvData}
                    onUpdate={setCVData}
                    onGenerate={handleGenerate}
                    showJobContext={false}
                    showOptimizeButton={false}
                  >
                    <div className="flex gap-4 pt-4 border-t">
                      <Button
                        size="lg"
                        className="flex-1"
                        onClick={() => setActiveTab('generate')}
                      >
                        Next: Generate CV
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </Button>
                      <Button
                        variant="outline"
                        size="lg"
                        onClick={() => setIsUploaded(false)}
                      >
                        Upload Different CV
                      </Button>
                    </div>
                  </CVGenerator>
                </div>
              )}
            </div>
          </TabsContent>

          {/* 2. Generate Tab */}
          <TabsContent value="generate" className="mt-0 animate-fade-in">
            <div className="glass-panel p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Step 2: Tailor & Generate</h2>
              <p className="text-muted-foreground">
                Review your extracted info and click "AI Optimize CV" to tailor it for the selected job.
              </p>
            </div>
            <CVGenerator
              selectedJob={selectedJob}
              cvData={cvData}
              onUpdate={setCVData}
              onGenerate={handleGenerate}
            />
          </TabsContent>

          {/* 3. Preview Tab */}
          <TabsContent value="preview" className="mt-0 animate-fade-in">
            <div className="glass-panel p-6 mb-6">
              <h2 className="text-xl font-semibold mb-4">Step 3: Preview</h2>
              <p className="text-muted-foreground">
                Review the final generated CV. You can go back to "Generate" to make edits if needed.
              </p>
            </div>
            <CVPreview
              cvData={cvData}
              onDownload={() => setActiveTab('download')}
            />
          </TabsContent>

          {/* 4. Download Tab */}
          <TabsContent value="download" className="mt-0 animate-fade-in">
            <div className="glass-panel p-8 text-center max-w-2xl mx-auto">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <Download className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Ready to Download</h2>
              <p className="text-muted-foreground mb-8">
                Your tailored CV is ready. Click the button below to download the PDF.
              </p>

              <div className="flex flex-col gap-4 max-w-xs mx-auto">
                <Button size="lg" onClick={handleDownload} className="w-full">
                  <Download className="w-5 h-5 mr-2" />
                  Download PDF
                </Button>

                <Button variant="outline" onClick={() => setActiveTab('preview')} className="w-full">
                  Back to Preview
                </Button>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </DashboardLayout>
  );
}
