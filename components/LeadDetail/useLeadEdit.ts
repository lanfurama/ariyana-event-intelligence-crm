import { useEffect, useState } from 'react';
import type { Lead } from '../../types';

export function useLeadEdit(lead: Lead, onSave: (l: Lead) => void) {
  const [isEditing, setIsEditing] = useState(false);
  const [editedLead, setEditedLead] = useState<Lead>(lead);

  useEffect(() => {
    setEditedLead(lead);
  }, [lead]);

  const handleInputChange = <K extends keyof Lead>(field: K, value: Lead[K]) => {
    setEditedLead((prev) => ({ ...prev, [field]: value }));
  };

  const handleSaveChanges = () => {
    onSave(editedLead);
    setIsEditing(false);
  };

  return {
    isEditing,
    setIsEditing,
    editedLead,
    setEditedLead,
    handleInputChange,
    handleSaveChanges,
  };
}
