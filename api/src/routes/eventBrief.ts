import { Router, Request, Response } from 'express';
import { Document, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType, AlignmentType, HeadingLevel, BorderStyle } from 'docx';

const router = Router();

// Helper function to create table cell with text
const createCell = (text: string, isHeader: boolean = false, shaded: boolean = false): TableCell => {
  return new TableCell({
    children: [
      new Paragraph({
        children: [
          new TextRun({
            text: text || 'N/A',
            bold: isHeader,
            size: isHeader ? 22 : 20,
          }),
        ],
        alignment: AlignmentType.LEFT,
      }),
    ],
    shading: shaded ? {
      fill: 'F1F5F9',
      val: 'clear',
    } : undefined,
  });
};

// Helper to create section heading
const createHeading = (text: string): Paragraph => {
  return new Paragraph({
    children: [
      new TextRun({
        text,
        bold: true,
        size: 24,
        color: '1E293B',
      }),
    ],
    heading: HeadingLevel.HEADING_2,
    spacing: { before: 400, after: 200 },
  });
};

// Helper to mark AI researched field
const markAI = (value: string, field: string, aiFilledFields: string[]): string => {
  if (aiFilledFields && aiFilledFields.includes(field) && value && value !== 'N/A') {
    return `${value} [AI Researched]`;
  }
  return value || 'N/A';
};

// POST /api/event-brief/export - Export Event Brief to Word document
router.post('/export', async (req: Request, res: Response) => {
  try {
    const { lead } = req.body;

    if (!lead) {
      return res.status(400).json({ error: 'Lead data is required' });
    }

    const aiFilledFields = lead.aiFilledFields || [];
    
    // Create document sections
    const sections: (Paragraph | Table)[] = [];

    // Title
    sections.push(
      new Paragraph({
        children: [
          new TextRun({
            text: 'EVENT BRIEF',
            bold: true,
            size: 36,
            color: '1E40AF',
          }),
        ],
        spacing: { after: 200 },
      })
    );

    // Score
    sections.push(
      new Paragraph({
        children: [
          new TextRun({
            text: `Strategic Fit Score: ${lead.totalScore || 0}/100`,
            bold: true,
            size: 24,
          }),
        ],
        spacing: { after: 400 },
      })
    );

    // ===== EVENT BRIEF SECTION =====
    sections.push(createHeading('Event Brief'));
    
    const eventBriefRows: TableRow[] = [
      new TableRow({
        children: [
          createCell('Event Name', false, true),
          createCell(lead.companyName || 'N/A'),
        ],
      }),
      new TableRow({
        children: [
          createCell('Industry', false, true),
          createCell(markAI(lead.industry, 'industry', aiFilledFields)),
        ],
      }),
      new TableRow({
        children: [
          createCell('Average Attendance', false, true),
          createCell(lead.numberOfDelegates ? `${lead.numberOfDelegates.toLocaleString()} pax` : 'N/A'),
        ],
      }),
      new TableRow({
        children: [
          createCell('Open Year', false, true),
          createCell(markAI(lead.openYear || lead.foundedYear, 'openYear', aiFilledFields)),
        ],
      }),
      new TableRow({
        children: [
          createCell('Frequency', false, true),
          createCell(markAI(lead.frequency, 'frequency', aiFilledFields)),
        ],
      }),
      new TableRow({
        children: [
          createCell('Rotation Area & Pattern', false, true),
          createCell(markAI(lead.rotationPattern, 'rotationPattern', aiFilledFields)),
        ],
      }),
      new TableRow({
        children: [
          createCell('Duration of Event', false, true),
          createCell(markAI(lead.duration || lead.eventDuration, 'duration', aiFilledFields)),
        ],
      }),
      new TableRow({
        children: [
          createCell('Preferred Month', false, true),
          createCell(markAI(lead.preferredMonth || lead.preferredMonths, 'preferredMonth', aiFilledFields)),
        ],
      }),
      new TableRow({
        children: [
          createCell('Preferred Venue', false, true),
          createCell(lead.preferredVenue || 'Hotel with convention facilities or Convention Centre'),
        ],
      }),
      new TableRow({
        children: [
          createCell('Break-Out Rooms', false, true),
          createCell(markAI(lead.breakoutRooms || lead.breakOutRooms, 'breakoutRooms', aiFilledFields)),
        ],
      }),
      new TableRow({
        children: [
          createCell('Size of Rooms', false, true),
          createCell(markAI(lead.roomSizes || lead.sizeOfRooms, 'roomSizes', aiFilledFields)),
        ],
      }),
      new TableRow({
        children: [
          createCell('Info on Last / Upcoming Events', false, true),
          createCell(markAI(lead.upcomingEvents || lead.lastEventInfo, 'upcomingEvents', aiFilledFields)),
        ],
      }),
      new TableRow({
        children: [
          createCell('Delegates Profile', false, true),
          createCell(markAI(lead.delegatesProfile, 'delegatesProfile', aiFilledFields)),
        ],
      }),
    ];

    sections.push(
      new Table({
        rows: eventBriefRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [3000, 6000],
      })
    );

    // ===== EVENT HISTORY SECTION =====
    if (lead.editions && Array.isArray(lead.editions) && lead.editions.length > 0) {
      sections.push(createHeading('Event History'));
      
      // Event History Table Header
      const eventHistoryRows: TableRow[] = [
        new TableRow({
          children: [
            createCell('Date', true),
            createCell('Congress', true),
            createCell('Venue', true),
            createCell('Organizing Chairman', true),
            createCell('Secretary General', true),
          ],
        }),
      ];

      // Add edition rows
      lead.editions.forEach((edition: any) => {
        const startDate = edition.STARTDATE || edition.StartDate || edition.startDate || '';
        const editionYear = edition.EDITYEARS || edition.EditYears || edition.edityears || '';
        const date = editionYear || startDate || 'N/A';
        
        const seriesName = edition.SeriesName || edition.SERIESNAME || edition.seriesName || '';
        const seriesEdition = edition.SeriesEditions || edition.SERIESEDITIONS || edition.seriesEditions || edition.Sequence || edition.SEQUENCE || '';
        const congress = seriesEdition ? `${seriesEdition} ${seriesName}` : seriesName || 'N/A';
        
        const city = edition.CITY || edition.City || edition.city || '';
        const country = edition.COUNTRY || edition.Country || edition.country || '';
        const venue = [city, country].filter(Boolean).join(', ') || 'N/A';
        
        const chairman = edition.Chairman || edition.chairman || edition.aiChairman || 'N/A';
        const secretary = edition.Secretary || edition.secretary || edition.aiSecretary || 'N/A';
        
        const chairmanText = edition.aiChairman && !edition.Chairman ? `${chairman} [AI]` : chairman;
        const secretaryText = edition.aiSecretary && !edition.Secretary ? `${secretary} [AI]` : secretary;
        
        eventHistoryRows.push(
          new TableRow({
            children: [
              createCell(date),
              createCell(congress),
              createCell(venue),
              createCell(chairmanText),
              createCell(secretaryText),
            ],
          })
        );
      });

      sections.push(
        new Table({
          rows: eventHistoryRows,
          width: { size: 100, type: WidthType.PERCENTAGE },
        })
      );
    }

    // ===== INTERNATIONAL ORGANISATION SECTION =====
    sections.push(createHeading('International Organisation & Local Host Information'));
    
    const orgRows: TableRow[] = [
      new TableRow({
        children: [
          createCell('Name of International Organisation', false, true),
          createCell(lead.organizationName || lead.companyName || 'N/A'),
        ],
      }),
      new TableRow({
        children: [
          createCell('Event Name', false, true),
          createCell(lead.companyName || 'N/A'),
        ],
      }),
      new TableRow({
        children: [
          createCell('Website', false, true),
          createCell(markAI(lead.website, 'website', aiFilledFields)),
        ],
      }),
      new TableRow({
        children: [
          createCell('Organisation Profile', false, true),
          createCell(markAI(lead.organizationProfile || lead.notes, 'organizationProfile', aiFilledFields)),
        ],
      }),
      new TableRow({
        children: [
          createCell('Name of Local Host / Member', false, true),
          createCell(markAI(lead.keyPersonName || lead.localHostName, 'keyPersonName', aiFilledFields)),
        ],
      }),
      new TableRow({
        children: [
          createCell('Title', false, true),
          createCell(markAI(lead.keyPersonTitle, 'keyPersonTitle', aiFilledFields)),
        ],
      }),
      new TableRow({
        children: [
          createCell('Email', false, true),
          createCell(markAI(lead.keyPersonEmail, 'keyPersonEmail', aiFilledFields)),
        ],
      }),
      new TableRow({
        children: [
          createCell('Phone', false, true),
          createCell(markAI(lead.keyPersonPhone, 'keyPersonPhone', aiFilledFields)),
        ],
      }),
      new TableRow({
        children: [
          createCell('Local Strengths & Weaknesses', false, true),
          createCell(markAI(lead.localStrengthsWeaknesses, 'localStrengthsWeaknesses', aiFilledFields)),
        ],
      }),
    ];

    sections.push(
      new Table({
        rows: orgRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [3000, 6000],
      })
    );

    // ===== BIDDING INFORMATION SECTION =====
    sections.push(createHeading('Bidding Information'));
    
    const biddingRows: TableRow[] = [
      new TableRow({
        children: [
          createCell('Decision Maker', false, true),
          createCell(markAI(lead.decisionMaker || 'Local host', 'decisionMaker', aiFilledFields)),
        ],
      }),
      new TableRow({
        children: [
          createCell('Decision Making Process', false, true),
          createCell(markAI(lead.decisionMakingProcess, 'decisionMakingProcess', aiFilledFields)),
        ],
      }),
      new TableRow({
        children: [
          createCell('Key Bid Criteria', false, true),
          createCell(lead.keyBidCriteria || 'Venue capacity & breakout rooms, Connectivity'),
        ],
      }),
      new TableRow({
        children: [
          createCell('Competitors', false, true),
          createCell(markAI(lead.competitors, 'competitors', aiFilledFields)),
        ],
      }),
      new TableRow({
        children: [
          createCell('Competitive Analysis', false, true),
          createCell(lead.competitiveAnalysis || 'Previous & current bid'),
        ],
      }),
      new TableRow({
        children: [
          createCell('Host Responsibility', false, true),
          createCell(lead.hostResponsibility || 'Organising Committee, responsible for selection of destination, venue and event plan'),
        ],
      }),
    ];

    sections.push(
      new Table({
        rows: biddingRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [3000, 6000],
      })
    );

    // ===== OTHER INFORMATION SECTION =====
    sections.push(createHeading('Other Information'));
    
    const otherRows: TableRow[] = [
      new TableRow({
        children: [
          createCell('Sponsors', false, true),
          createCell(markAI(lead.sponsors || lead.sponsorInfo, 'sponsors', aiFilledFields)),
        ],
      }),
      new TableRow({
        children: [
          createCell('Layout Event', false, true),
          createCell(markAI(lead.layoutEvent || lead.eventLayout, 'layoutEvent', aiFilledFields)),
        ],
      }),
      new TableRow({
        children: [
          createCell('Conference Registration', false, true),
          createCell(markAI(lead.conferenceRegistration, 'conferenceRegistration', aiFilledFields)),
        ],
      }),
      new TableRow({
        children: [
          createCell('ICCA Qualified', false, true),
          createCell(markAI(lead.iccaQualified, 'iccaQualified', aiFilledFields)),
        ],
      }),
    ];

    if (lead.researchSummary) {
      otherRows.push(
        new TableRow({
          children: [
            createCell('AI Research Summary', false, true),
            createCell(lead.researchSummary),
          ],
        })
      );
    }

    sections.push(
      new Table({
        rows: otherRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
        columnWidths: [3000, 6000],
      })
    );

    // AI Research Note
    if (aiFilledFields.length > 0) {
      sections.push(
        new Paragraph({
          children: [
            new TextRun({
              text: `\nNote: ${aiFilledFields.length} field(s) were auto-filled using AI research and are marked with [AI Researched].`,
              italics: true,
              size: 18,
              color: '3B82F6',
            }),
          ],
          spacing: { before: 400 },
        })
      );
    }

    // Create Word document
    const doc = new Document({
      sections: [
        {
          children: sections,
        },
      ],
    });

    // Generate Word document buffer
    const buffer = await Packer.toBuffer(doc);

    // Set response headers for file download (FIX: Remove underscore, use hyphen)
    const fileName = `Event-Brief-${(lead.companyName || 'Event').replace(/[^a-zA-Z0-9]/g, '-')}-${new Date().getFullYear()}.docx`;
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${encodeURIComponent(fileName)}"`);
    res.setHeader('Content-Length', buffer.length.toString());

    console.log(`✅ [Export] Exporting Event Brief: ${fileName}`);

    // Send file
    res.send(buffer);
  } catch (error: any) {
    console.error('Error exporting Event Brief:', error);
    res.status(500).json({
      error: error.message || 'Failed to export Event Brief',
    });
  }
});

export default router;
