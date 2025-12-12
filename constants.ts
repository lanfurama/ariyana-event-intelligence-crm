import { Lead, User } from './types';

export const EMAIL_TEMPLATES = [
  {
    id: 'intro',
    name: 'Introduction',
    subject: 'Proposal to host [Company Name] event at Ariyana Convention Centre',
    body: `Dear [Key Person Name],

I hope this email finds you well.

My name is [Your Name], representing Ariyana Convention Centre in Danang, Vietnam. We are Vietnam's premier oceanfront convention venue and had the honor of hosting the APEC 2017 Economic Leaders' Week.

I am writing to express our keen interest in hosting [Company Name]'s upcoming events. With our versatile ballrooms and stunning location, we believe we can offer an exceptional experience for your delegates.

Would you be open to a brief call to discuss how we can support your future events?

Best regards,`
  },
  {
    id: 'followup',
    name: 'Follow Up',
    subject: 'Following up: [Company Name] Event Proposal',
    body: `Dear [Key Person Name],

I'm writing to follow up on my previous note regarding the possibility of hosting [Company Name] at Ariyana Convention Centre.

Danang is rapidly becoming a top destination for MICE in Asia, offering excellent connectivity and world-class infrastructure. We would love the opportunity to showcase what we can offer for your next conference.

Looking forward to hearing from you.

Best regards,`
  },
  {
    id: 'promo',
    name: 'Special Offer',
    subject: 'Exclusive MICE Package for [Company Name]',
    body: `Dear [Key Person Name],

We are currently offering exclusive packages for international associations looking to host events in Danang for 2026/2027.

We see a great alignment with [Company Name]'s values and event requirements. Our venue offers:
- Largest ballroom in Central Vietnam
- Direct beach access
- Comprehensive event support services

Let's make your next event unforgettable.

Best regards,`
  }
];

export const USERS: User[] = [
  { 
    username: 'director', 
    name: 'Sarah Jenkins', 
    role: 'Director',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah' 
  },
  { 
    username: 'sales', 
    name: 'Mike Sales', 
    role: 'Sales',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Mike' 
  },
  { 
    username: 'viewer', 
    name: 'Guest Viewer', 
    role: 'Viewer',
    avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Guest' 
  }
];

export const INITIAL_LEADS: Lead[] = [
  {
    id: '1',
    companyName: 'Architects Regional Council Asia (ARCASIA)',
    industry: 'Architecture',
    country: 'India',
    city: 'Mumbai',
    website: 'https://www.arcasia.org',
    keyPersonName: 'Ar. J.P. Singh',
    keyPersonTitle: 'Secretary General',
    keyPersonEmail: 'arcasia.secretariat@gmail.com',
    keyPersonPhone: '+91 22 2640 0340',
    keyPersonLinkedIn: 'https://www.linkedin.com/in/j-p-singh-499a0715/',
    totalEvents: 1,
    vietnamEvents: 1,
    notes: 'Potential for ARCASIA Forum return.',
    status: 'New',
    pastEventsHistory: '2023: Manila, Philippines; 2022: Ulaanbaatar, Mongolia',
    researchNotes: '',
    secondaryPersonName: '',
    secondaryPersonTitle: '',
    secondaryPersonEmail: '',
    numberOfDelegates: 500
  },
  {
    id: '2',
    companyName: 'ASEAN Federation of Accountants (AFA)',
    industry: 'Finance',
    country: 'Malaysia',
    city: 'Kuala Lumpur',
    website: 'http://www.aseanaccountants.org',
    keyPersonName: 'Wan Chew Meng',
    keyPersonTitle: 'Executive Director',
    keyPersonEmail: 'wanchewmeng@afa-secretariat.org',
    keyPersonPhone: '+603 2093 3030',
    keyPersonLinkedIn: 'https://www.linkedin.com/in/wan-chew-meng-80b6a9138',
    totalEvents: 1,
    vietnamEvents: 2,
    notes: 'Organized 3rd AFA Conference previously.',
    status: 'Contacted',
    lastContacted: '2023-10-15',
    pastEventsHistory: '2021: Virtual; 2019: Brunei Darussalam',
    researchNotes: '',
    numberOfDelegates: 350
  },
  {
    id: '3',
    companyName: 'Asean Federation of Cement Manufacturers (AFCM)',
    industry: 'Construction',
    country: 'Thailand',
    city: 'Bangkok',
    website: '',
    keyPersonName: 'Mr. Apichart Ruangkritya',
    keyPersonTitle: 'Secretary General',
    keyPersonEmail: 'secretariat@afcm.org',
    keyPersonPhone: '+66 2 658 0900',
    keyPersonLinkedIn: '',
    totalEvents: 1,
    vietnamEvents: 1,
    notes: 'Technical Symposium & Exhibition target.',
    status: 'New',
    pastEventsHistory: '',
    numberOfDelegates: 200
  },
  {
    id: '4',
    companyName: 'ASEAN Law Association (ALA)',
    industry: 'Legal',
    country: 'Singapore',
    city: 'Singapore',
    website: 'https://www.aseanlawassociation.org',
    keyPersonName: 'Adrian Tan',
    keyPersonTitle: 'Secretary-General',
    keyPersonEmail: 'secretariat@aseanlawassociation.org',
    keyPersonPhone: '',
    keyPersonLinkedIn: 'https://www.linkedin.com/in/adrian-tan-808a9a10/',
    totalEvents: 1,
    vietnamEvents: 1,
    notes: '13th ASEAN Law Association General Assembly.',
    status: 'New',
    pastEventsHistory: '',
    numberOfDelegates: 450
  },
  {
    id: '5',
    companyName: 'ASEAN Valuers Association (AVA)',
    industry: 'Real Estate',
    country: 'Malaysia',
    city: 'Kuala Lumpur',
    website: '',
    keyPersonName: 'Faizal Bin Abdul Rahman',
    keyPersonTitle: 'Secretary General',
    keyPersonEmail: 'secretariat@aseanvaluers.org',
    keyPersonPhone: '+603-2287 9036',
    keyPersonLinkedIn: 'https://www.linkedin.com/in/faizal-abdul-rahman-500b5212/',
    totalEvents: 1,
    vietnamEvents: 1,
    notes: 'Congress of the ASEAN Valuers Association.',
    status: 'New',
    pastEventsHistory: '',
    numberOfDelegates: 300
  },
  {
    id: '6',
    companyName: 'Asia-Oceania Federation of Organizations for Medical Physics',
    industry: 'Medical',
    country: 'Vietnam',
    city: 'Hue',
    website: '',
    keyPersonName: 'Dr. Hoang Van Duc',
    keyPersonTitle: 'Secretary General',
    keyPersonEmail: 'hoangvanduc@afomp.org',
    keyPersonPhone: '',
    keyPersonLinkedIn: 'https://www.linkedin.com/in/duc-hoang-van-0b5b1b17/',
    totalEvents: 1,
    vietnamEvents: 1,
    notes: 'Strong local connection. Priority.',
    status: 'Qualified',
    pastEventsHistory: '',
    numberOfDelegates: 600
  },
  {
    id: '7',
    companyName: 'Asia-Pacific Broadcasting Union (ABU)',
    industry: 'Media',
    country: 'Malaysia',
    city: 'Kuala Lumpur',
    website: 'https://www.abu.org.my',
    keyPersonName: 'Ahmed Nadeem',
    keyPersonTitle: 'Director of Programmes',
    keyPersonEmail: 'info@abu.org.my',
    keyPersonPhone: '+603 2282 2480',
    keyPersonLinkedIn: 'https://www.linkedin.com/in/ahmed-nadeem-251b5b11/',
    totalEvents: 3,
    vietnamEvents: 1,
    notes: 'RadioAsia organizer.',
    status: 'New',
    pastEventsHistory: '2023: Seoul, Korea; 2022: New Delhi, India',
    numberOfDelegates: 800
  },
   {
    id: '8',
    companyName: 'International Air Transport Association (IATA)',
    industry: 'Aviation',
    country: 'Switzerland',
    city: 'Geneva',
    website: 'iata.org',
    keyPersonName: 'Monika White',
    keyPersonTitle: 'Head of Conferences & Events',
    keyPersonEmail: 'monika.white@iata.org',
    keyPersonPhone: '',
    keyPersonLinkedIn: 'https://www.linkedin.com/in/monika-white-5b12a81/',
    totalEvents: 1,
    vietnamEvents: 0,
    notes: 'High value target for global aviation summit.',
    status: 'New',
    pastEventsHistory: '2024: Dubai, UAE; 2023: Istanbul, Turkey',
    numberOfDelegates: 2000
  },
  {
    id: '9',
    companyName: 'Asia Pacific Network (SAFE-Network)',
    industry: 'Agriculture/Energy',
    country: 'Japan',
    city: 'Takamatsu',
    website: '',
    keyPersonName: 'Prof. Dr. Makoto Kawase',
    keyPersonTitle: 'Secretary General',
    keyPersonEmail: 'safe.network.secretariat@gmail.com',
    keyPersonPhone: '',
    keyPersonLinkedIn: 'https://www.linkedin.com/in/makoto-kawase-a500b4111/',
    totalEvents: 1,
    vietnamEvents: 1,
    notes: 'International Conference on Sustainable Agriculture.',
    status: 'New',
    pastEventsHistory: '',
    numberOfDelegates: 150
  },
  {
    id: '10',
    companyName: 'Asian-Oceanian Computing Industry Organization (ASOCIO)',
    industry: 'Technology',
    country: 'Malaysia',
    city: 'Petaling Jaya',
    website: '',
    keyPersonName: 'Alice Tan',
    keyPersonTitle: 'Executive Director',
    keyPersonEmail: 'secretariat@asocio.org',
    keyPersonPhone: '+603-7873 8733',
    keyPersonLinkedIn: 'https://www.linkedin.com/in/alice-tan-b9560010/',
    totalEvents: 1,
    vietnamEvents: 1,
    notes: 'ASOCIO Digital Summit.',
    status: 'New',
    pastEventsHistory: '',
    numberOfDelegates: 1200
  },
  {
    id: '11',
    companyName: 'Asian Association of Open Universities (AAOU)',
    industry: 'Education',
    country: 'Philippines',
    city: 'Laguna',
    website: '',
    keyPersonName: 'Dr. Melinda dela Peña Bandalaria',
    keyPersonTitle: 'Secretary General',
    keyPersonEmail: 'secretariat@aaou.org',
    keyPersonPhone: '',
    keyPersonLinkedIn: 'https://www.linkedin.com/in/melinda-dela-pe%C3%B1a-bandalaria-0b0b1b1a/',
    totalEvents: 1,
    vietnamEvents: 1,
    notes: '32nd Annual Conference of AAOU.',
    status: 'New',
    pastEventsHistory: '',
    numberOfDelegates: 400
  }
];