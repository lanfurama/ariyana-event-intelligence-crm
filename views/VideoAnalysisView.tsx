import React, { useState, useEffect } from 'react';
import { 
  Loader2, 
  BrainCircuit, 
  FileText, 
  Upload, 
  Film, 
  X 
} from 'lucide-react';
import * as GeminiService from '../services/geminiService';
import { extractRetryDelay as extractGeminiRetryDelay, isRateLimitError as isGeminiRateLimitError } from '../services/geminiService';

export const VideoAnalysisView = () => {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number | null>(null);
  const [videoAnalysisError, setVideoAnalysisError] = useState<string | null>(null);

  // Countdown effect for rate limit
  useEffect(() => {
    if (rateLimitCountdown !== null && rateLimitCountdown > 0) {
      const timer = setTimeout(() => {
        setRateLimitCountdown(prev => prev !== null ? prev - 1 : null);
      }, 1000);
      return () => clearTimeout(timer);
    } else if (rateLimitCountdown === 0) {
      setRateLimitCountdown(null);
    }
  }, [rateLimitCountdown]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // 9MB Safety Limit for XHR
      if (file.size > 9 * 1024 * 1024) {
        setVideoAnalysisError("File too large. Please upload an image or video under 9MB for this demo.");
        return;
      }
      setSelectedFile(file);
      setPreviewUrl(URL.createObjectURL(file));
      setAnalysis('');
      setVideoAnalysisError(null); // Clear previous errors when new file is selected
    }
  };

  const handleAnalyze = async () => {
    if (!selectedFile) return;

    setLoading(true);
    setRateLimitCountdown(null);
    setVideoAnalysisError(null); // Clear previous errors
    try {
      // Convert to Base64
      const reader = new FileReader();
      reader.readAsDataURL(selectedFile);
      reader.onload = async () => {
        try {
          const base64Str = (reader.result as string).split(',')[1];
          const result = await GeminiService.analyzeVideoContent(base64Str, selectedFile.type);
          setAnalysis(result);
          setVideoAnalysisError(null); // Clear error on success
        } catch (e: any) {
          console.error(e);
          if (isGeminiRateLimitError(e)) {
            const retryDelay = extractGeminiRetryDelay(e);
            if (retryDelay) {
              setRateLimitCountdown(retryDelay);
              setVideoAnalysisError(null); // Rate limit countdown will be shown separately
            } else {
              setVideoAnalysisError("Rate limit exceeded. Please try again later.");
            }
          } else {
            setVideoAnalysisError(`Analysis failed: ${e.message || 'Unknown error occurred'}`);
          }
        } finally {
          setLoading(false);
        }
      };
      reader.onerror = () => {
        setLoading(false);
        setVideoAnalysisError("Error reading file. Please try uploading again.");
      };
    } catch (e: any) {
      console.error(e);
      if (isGeminiRateLimitError(e)) {
        const retryDelay = extractGeminiRetryDelay(e);
        if (retryDelay) {
          setRateLimitCountdown(retryDelay);
          setVideoAnalysisError(null); // Rate limit countdown will be shown separately
        } else {
          setVideoAnalysisError("Rate limit exceeded. Please try again later.");
        }
      } else {
        setVideoAnalysisError(`Analysis failed: ${e.message || 'Unknown error occurred'}`);
      }
      setLoading(false);
    }
  };

  return (
    <div className="p-8 h-screen overflow-y-auto">
      <h2 className="text-2xl font-bold text-slate-800 mb-6">Competitor Video Intelligence</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="border-2 border-dashed border-slate-300 rounded-lg p-8 flex flex-col items-center justify-center text-center bg-white">
            <input
              type="file"
              accept="image/*,video/*"
              onChange={handleFileChange}
              className="hidden"
              id="video-upload"
            />
            {previewUrl ? (
              <div className="w-full relative">
                {selectedFile?.type.startsWith('video') ? (
                  <video src={previewUrl} controls className="w-full rounded-lg max-h-64 object-cover" />
                ) : (
                  <img src={previewUrl} alt="Preview" className="w-full rounded-lg max-h-64 object-cover" />
                )}
                <button
                  onClick={() => { setSelectedFile(null); setPreviewUrl(null); }}
                  className="absolute top-2 right-2 bg-red-500 text-white p-1 rounded-full shadow"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <label htmlFor="video-upload" className="cursor-pointer flex flex-col items-center">
                <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mb-4">
                  <Upload size={32} />
                </div>
                <h3 className="font-semibold text-slate-700">Upload Competitor Material</h3>
                <p className="text-sm text-slate-400 mt-2">Supports Images & Short Videos (Max 9MB)</p>
              </label>
            )}
          </div>

          {rateLimitCountdown !== null && rateLimitCountdown > 0 && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-yellow-800">Rate Limit Exceeded</p>
                  <p className="text-xs text-yellow-700 mt-1">Please wait before trying again</p>
                </div>
                <div className="text-2xl font-bold text-yellow-600">
                  {Math.floor(rateLimitCountdown / 60)}:{(rateLimitCountdown % 60).toString().padStart(2, '0')}
                </div>
              </div>
            </div>
          )}

          {videoAnalysisError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm font-semibold text-red-800">Error</p>
                  <p className="text-xs text-red-700 mt-1">{videoAnalysisError}</p>
                </div>
                <button
                  onClick={() => setVideoAnalysisError(null)}
                  className="text-red-600 flex-shrink-0 ml-2 p-1 rounded"
                  aria-label="Close error message"
                >
                  <X size={16} />
                </button>
              </div>
            </div>
          )}

          <button
            onClick={handleAnalyze}
            disabled={!selectedFile || loading || (rateLimitCountdown !== null && rateLimitCountdown > 0)}
            className="w-full py-3 bg-indigo-600 text-white rounded-lg font-bold text-lg disabled:opacity-50 flex justify-center items-center shadow-lg shadow-indigo-200"
          >
            {loading ? <Loader2 className="animate-spin mr-2" /> : <BrainCircuit className="mr-2" />}
            {rateLimitCountdown !== null && rateLimitCountdown > 0
              ? `Retry in ${rateLimitCountdown}s`
              : 'Analyze with Gemini AI'}
          </button>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-slate-200 h-full min-h-[400px]">
          <h3 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
            <FileText className="mr-2 text-indigo-500" /> Analysis Report
          </h3>
          {loading ? (
            <div className="flex flex-col items-center justify-center h-64 text-slate-400">
              <Loader2 size={40} className="animate-spin mb-4 text-indigo-500" />
              <p>Extracting insights...</p>
            </div>
          ) : analysis ? (
            <div className="prose prose-sm prose-indigo max-w-none text-slate-700 whitespace-pre-wrap">
              {analysis}
            </div>
          ) : videoAnalysisError ? (
            <div className="flex items-center justify-center h-64 text-red-400 italic">
              <div className="text-center">
                <p className="mb-2">⚠️ Analysis could not be completed</p>
                <p className="text-sm">Please check the error message above</p>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-64 text-slate-400 italic">
              Upload content to see AI insights here.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
