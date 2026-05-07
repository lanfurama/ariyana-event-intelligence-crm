import type { Dispatch, SetStateAction } from 'react';
import { useEffect, useState } from 'react';
import type { Lead } from '../../types';
import * as VertexAiService from '../../services/vertexAiService';
import { parseResearchResult, verifyEmail } from './leadDetailHelpers';

interface ResearchResults {
  name?: string;
  title?: string;
  email?: string;
  verificationStatus?: 'pending' | 'approved' | 'rejected' | 'auto-approved';
  verificationReason?: string;
}

export function useLeadEnrichment(
  lead: Lead,
  editedLead: Lead,
  setEditedLead: Dispatch<SetStateAction<Lead>>,
  onSave: (l: Lead) => void,
) {
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [enrichResult, setEnrichResult] = useState<{ text: string; grounding: any } | null>(null);
  const [rateLimitCountdown, setRateLimitCountdown] = useState<number | null>(null);
  const [enrichCompanyName, setEnrichCompanyName] = useState(lead.companyName || '');
  const [enrichKeyPerson, setEnrichKeyPerson] = useState(lead.keyPersonName || '');
  const [enrichCity, setEnrichCity] = useState(lead.city || '');
  const [researchResults, setResearchResults] = useState<ResearchResults | null>(null);

  // Sync enrich form fields when prop lead changes
  useEffect(() => {
    setEnrichCompanyName(lead.companyName || '');
    setEnrichKeyPerson(lead.keyPersonName || '');
    setEnrichCity(lead.city || '');
  }, [lead]);

  // Countdown effect for rate limit
  useEffect(() => {
    if (rateLimitCountdown !== null && rateLimitCountdown > 0) {
      const timer = setTimeout(() => {
        setRateLimitCountdown((prev) => (prev !== null ? prev - 1 : null));
      }, 1000);
      return () => clearTimeout(timer);
    } else if (rateLimitCountdown === 0) {
      setRateLimitCountdown(null);
    }
  }, [rateLimitCountdown]);

  const handleEnrich = async () => {
    if (!enrichCompanyName || enrichCompanyName.trim() === '') {
      alert('Please enter a company name');
      return;
    }

    setEnrichLoading(true);
    setRateLimitCountdown(null);
    setResearchResults(null);
    try {
      const result = await VertexAiService.enrichLeadData({
        companyName: enrichCompanyName.trim(),
        keyPerson: enrichKeyPerson.trim() || undefined,
        city: enrichCity.trim() || undefined,
        country: editedLead.country,
        website: editedLead.website,
        industry: editedLead.industry,
        keyPersonTitle: editedLead.keyPersonTitle,
        keyPersonEmail: editedLead.keyPersonEmail,
        keyPersonPhone: editedLead.keyPersonPhone,
        notes: editedLead.notes,
        researchNotes: editedLead.researchNotes,
        pastEventsHistory: editedLead.pastEventsHistory,
        secondaryPersonName: editedLead.secondaryPersonName,
        secondaryPersonTitle: editedLead.secondaryPersonTitle,
        secondaryPersonEmail: editedLead.secondaryPersonEmail,
      });
      setEnrichResult({ text: result.text, grounding: null });

      // Parse result to extract key person info
      const parsedInfo = parseResearchResult(result.text, enrichKeyPerson);

      // Verify email if found
      let verificationStatus: 'pending' | 'approved' | 'rejected' | 'auto-approved' = 'pending';
      let verificationReason = '';

      if (parsedInfo.email) {
        const verification = verifyEmail(parsedInfo.email, editedLead.website);
        verificationStatus = verification.status;
        verificationReason = verification.reason;

        // Auto-approve and update if domain matches
        if (verificationStatus === 'auto-approved') {
          const updatedLead = { ...editedLead };

          // Update key person info if found
          if (parsedInfo.name) {
            updatedLead.keyPersonName = parsedInfo.name;
          }
          if (parsedInfo.title) {
            updatedLead.keyPersonTitle = parsedInfo.title;
          }
          if (parsedInfo.email) {
            updatedLead.keyPersonEmail = parsedInfo.email;
          }

          // Add to research notes
          const notesUpdate = `[AI Research ${new Date().toLocaleDateString()}]: Found key person - ${parsedInfo.name || 'N/A'}, ${parsedInfo.title || 'N/A'}, ${parsedInfo.email} (Auto-approved: ${verificationReason})`;
          updatedLead.researchNotes = (updatedLead.researchNotes || '') + '\n\n' + notesUpdate;

          setEditedLead(updatedLead);
          onSave(updatedLead);
        }
      }

      setResearchResults({
        name: parsedInfo.name,
        title: parsedInfo.title,
        email: parsedInfo.email,
        verificationStatus,
        verificationReason,
      });
    } catch (e: any) {
      console.error(e);
      if (e?.isRateLimit) {
        const retryDelay = e?.retryDelay;
        if (typeof retryDelay === 'number' && retryDelay > 0) {
          setRateLimitCountdown(retryDelay);
        } else {
          alert('Rate limit exceeded. Please try again later.');
        }
      } else {
        alert(`Enrichment failed: ${e?.message || 'Please check API Key/Connection'}`);
      }
    } finally {
      setEnrichLoading(false);
    }
  };

  const handleApproveEmail = () => {
    if (!researchResults || !researchResults.email) return;

    const updatedLead = { ...editedLead };

    // Update key person info if found
    if (researchResults.name) {
      updatedLead.keyPersonName = researchResults.name;
    }
    if (researchResults.title) {
      updatedLead.keyPersonTitle = researchResults.title;
    }
    if (researchResults.email) {
      updatedLead.keyPersonEmail = researchResults.email;
    }

    // Add to research notes
    const notesUpdate = `[AI Research ${new Date().toLocaleDateString()}]: Found key person - ${researchResults.name || 'N/A'}, ${researchResults.title || 'N/A'}, ${researchResults.email} (Approved)`;
    updatedLead.researchNotes = (updatedLead.researchNotes || '') + '\n\n' + notesUpdate;

    setEditedLead(updatedLead);
    setResearchResults((prev) => (prev ? { ...prev, verificationStatus: 'approved' } : null));

    // Save to database
    onSave(updatedLead);
  };

  const handleRejectEmail = () => {
    if (!researchResults) return;
    setResearchResults((prev) => (prev ? { ...prev, verificationStatus: 'rejected' } : null));
  };

  const handleSaveEnrichment = () => {
    if (enrichResult) {
      const updatedNotes =
        (editedLead.researchNotes || '') +
        '\n\n' +
        `[AI Search ${new Date().toLocaleDateString()}]: ` +
        enrichResult.text;
      const newLead = { ...editedLead, researchNotes: updatedNotes };
      setEditedLead(newLead);
      onSave(newLead);
      alert('Search results saved to Research Notes.');
    }
  };

  return {
    enrichLoading,
    enrichResult,
    rateLimitCountdown,
    enrichCompanyName,
    setEnrichCompanyName,
    enrichKeyPerson,
    setEnrichKeyPerson,
    enrichCity,
    setEnrichCity,
    researchResults,
    handleEnrich,
    handleApproveEmail,
    handleRejectEmail,
    handleSaveEnrichment,
  };
}
