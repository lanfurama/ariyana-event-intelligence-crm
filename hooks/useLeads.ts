import { useState, useEffect } from 'react';
import { Lead, User } from '../types';
import { leadsApi } from '../services/apiService';
import { mapLeadFromDB, mapLeadToDB } from '../utils/leadUtils';
import { INITIAL_LEADS } from '../constants';

export const useLeads = (user: User | null) => {
    const [leads, setLeads] = useState<Lead[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedLead, setSelectedLead] = useState<Lead | null>(null);

    // Fetch leads when user changes
    useEffect(() => {
        if (user) {
            fetchLeads();
        } else {
            setLeads([]);
        }
    }, [user]);

    const fetchLeads = async () => {
        try {
            setLoading(true);
            const fetchedLeads = await leadsApi.getAll();
            const mappedLeads = fetchedLeads.map(mapLeadFromDB);
            setLeads(mappedLeads);
        } catch (error) {
            console.error('Error fetching leads:', error);
            setLeads(INITIAL_LEADS);
        } finally {
            setLoading(false);
        }
    };

    const updateLead = async (updatedLead: Lead) => {
        try {
            const mappedLead = mapLeadToDB(updatedLead);
            const updated = await leadsApi.update(updatedLead.id, mappedLead);
            const mappedBack = mapLeadFromDB(updated);

            setLeads(prev => prev.map(l => l.id === updatedLead.id ? mappedBack : l));
            if (selectedLead && selectedLead.id === updatedLead.id) {
                setSelectedLead(mappedBack);
            }
        } catch (error) {
            console.error('Error updating lead:', error);
            // Optimistic update fallback
            setLeads(prev => prev.map(l => l.id === updatedLead.id ? updatedLead : l));
            if (selectedLead && selectedLead.id === updatedLead.id) {
                setSelectedLead(updatedLead);
            }
        }
    };

    const addLeads = async (newLeads: Lead[]): Promise<void> => {
        if (newLeads.length === 0) return;

        try {
            console.log('💾 Starting to save', newLeads.length, 'leads to database...');
            const existingLeads = await leadsApi.getAll();
            const existingLeadsMap = new Map<string, any>();
            existingLeads.forEach(l => {
                const key = l.company_name?.toLowerCase().trim();
                if (key) existingLeadsMap.set(key, l);
            });

            let successCount = 0;
            let updatedCount = 0;
            let duplicateCount = 0;
            let failCount = 0;

            for (const lead of newLeads) {
                try {
                    const companyNameLower = lead.companyName?.toLowerCase().trim();
                    const existingLead = companyNameLower ? existingLeadsMap.get(companyNameLower) : null;

                    if (existingLead) {
                        const existingKeyPersonEmail = existingLead.key_person_email || existingLead.keyPersonEmail || '';
                        const importKeyPersonEmail = lead.keyPersonEmail || '';

                        if (!existingKeyPersonEmail.trim() && importKeyPersonEmail.trim()) {
                            console.log(`🔄 Updating key_person_email for existing lead: ${lead.companyName}`);
                            await leadsApi.update(existingLead.id, { key_person_email: importKeyPersonEmail.trim() });
                            updatedCount++;
                        } else {
                            console.log(`⏭️  Skipping duplicate lead: ${lead.companyName}`);
                            duplicateCount++;
                        }
                        continue;
                    }

                    const mappedLead = mapLeadToDB(lead);
                    await leadsApi.create(mappedLead);
                    successCount++;

                    if (companyNameLower) {
                        existingLeadsMap.set(companyNameLower, { id: mappedLead.id, company_name: mappedLead.company_name });
                    }
                } catch (error: any) {
                    if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
                        duplicateCount++;
                    } else {
                        console.error('❌ Error creating lead:', lead.companyName, error);
                        failCount++;
                    }
                }
            }

            console.log(`Summary: Saved ${successCount}, Updated ${updatedCount}, Skipped ${duplicateCount}, Failed ${failCount}`);

            // Refresh leads
            const fetchedLeads = await leadsApi.getAll();
            setLeads(fetchedLeads.map(mapLeadFromDB));
        } catch (error) {
            console.error('❌ Error adding leads:', error);
            throw error;
        }
    };

    const addNewLead = () => {
        const newLead: Lead = {
            id: `new-${Date.now()}`,
            companyName: '',
            industry: '',
            country: '',
            city: '',
            website: '',
            keyPersonName: '',
            keyPersonTitle: '',
            keyPersonEmail: '',
            keyPersonPhone: '',
            keyPersonLinkedIn: '',
            totalEvents: 0,
            vietnamEvents: 0,
            notes: '',
            status: 'New',
        };
        setSelectedLead(newLead);
    };

    return {
        leads,
        loading,
        selectedLead,
        setSelectedLead,
        updateLead,
        addLeads,
        addNewLead,
        fetchLeads
    };
};
