// Utilities for location, Indian states & Kerala districts

export const INDIAN_STATES = [
  'Kerala',
  'Andaman and Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra and Nagar Haveli and Daman and Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu and Kashmir',
  'Jharkhand',
  'Karnataka',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
];

export const KERALA_DISTRICTS = [
  'Alappuzha',
  'Ernakulam',
  'Idukki',
  'Kannur',
  'Kasaragod',
  'Kollam',
  'Kottayam',
  'Kozhikode',
  'Malappuram',
  'Palakkad',
  'Pathanamthitta',
  'Thiruvananthapuram',
  'Thrissur',
  'Wayanad',
];

export const STATE_DISTRICTS = {
  Kerala: KERALA_DISTRICTS,
  'Tamil Nadu': [
    'Ariyalur',
    'Chengalpattu',
    'Chennai',
    'Coimbatore',
    'Cuddalore',
    'Dharmapuri',
    'Dindigul',
    'Erode',
    'Kallakurichi',
    'Kanchipuram',
    'Kanyakumari',
    'Karur',
    'Krishnagiri',
    'Madurai',
    'Mayiladuthurai',
    'Nagapattinam',
    'Namakkal',
    'Nilgiris',
    'Perambalur',
    'Pudukkottai',
    'Ramanathapuram',
    'Ranipet',
    'Salem',
    'Sivaganga',
    'Tenkasi',
    'Thanjavur',
    'Theni',
    'Thoothukudi',
    'Tiruchirappalli',
    'Tirunelveli',
    'Tirupathur',
    'Tiruppur',
    'Tiruvallur',
    'Tiruvannamalai',
    'Tiruvarur',
    'Vellore',
    'Viluppuram',
    'Virudhunagar',
  ],
  Karnataka: [
    'Bagalkot',
    'Ballari',
    'Belagavi',
    'Bengaluru Rural',
    'Bengaluru Urban',
    'Bidar',
    'Chamarajanagar',
    'Chikkaballapur',
    'Chikkamagaluru',
    'Chitradurga',
    'Dakshina Kannada',
    'Davanagere',
    'Dharwad',
    'Gadag',
    'Hassan',
    'Haveri',
    'Kalaburagi',
    'Kodagu',
    'Kolar',
    'Koppal',
    'Mandya',
    'Mysuru',
    'Raichur',
    'Ramanagara',
    'Shivamogga',
    'Tumakuru',
    'Udupi',
    'Uttara Kannada',
    'Vijayapura',
    'Yadgir',
  ],
  'Andhra Pradesh': [
    'Ananthapuramu',
    'Chittoor',
    'East Godavari',
    'Guntur',
    'Krishna',
    'Kurnool',
    'Prakasam',
    'Srikakulam',
    'Sri Potti Sriramulu Nellore',
    'Visakhapatnam',
    'Vizianagaram',
    'West Godavari',
    'YSR Kadapa',
  ],
  Telangana: [
    'Adilabad',
    'Bhadradri Kothagudem',
    'Hyderabad',
    'Jagtial',
    'Jangaon',
    'Jayashankar Bhupalpally',
    'Jogulamba Gadwal',
    'Kamareddy',
    'Karimnagar',
    'Khammam',
    'Kumuram Bheem Asifabad',
    'Mahabubabad',
    'Mahabubnagar',
    'Mancherial',
    'Medak',
    'Medchal-Malkajgiri',
    'Mulugu',
    'Nagarkurnool',
    'Nalgonda',
    'Narayanpet',
    'Nirmal',
    'Nizamabad',
    'Peddapalli',
    'Rajanna Sircilla',
    'Rangareddy',
    'Sangareddy',
    'Siddipet',
    'Suryapet',
    'Vikarabad',
    'Wanaparthy',
    'Warangal',
    'Yadadri Bhuvanagiri',
  ],
  Maharashtra: [
    'Ahmednagar',
    'Akola',
    'Amravati',
    'Aurangabad',
    'Beed',
    'Bhandara',
    'Buldhana',
    'Chandrapur',
    'Dhule',
    'Gadchiroli',
    'Gondia',
    'Hingoli',
    'Jalgaon',
    'Jalna',
    'Kolhapur',
    'Latur',
    'Mumbai City',
    'Mumbai Suburban',
    'Nagpur',
    'Nanded',
    'Nandurbar',
    'Nashik',
    'Osmanabad',
    'Palghar',
    'Parbhani',
    'Pune',
    'Raigad',
    'Ratnagiri',
    'Sangli',
    'Satara',
    'Sindhudurg',
    'Solapur',
    'Thane',
    'Wardha',
    'Washim',
    'Yavatmal',
  ],
};

export const getDistrictsForState = (stateName) => {
  if (!stateName || typeof stateName !== 'string') {
    return KERALA_DISTRICTS;
  }
  const match = Object.keys(STATE_DISTRICTS).find(
    (s) => s.toLowerCase() === stateName.trim().toLowerCase()
  );
  if (match && STATE_DISTRICTS[match]) {
    return STATE_DISTRICTS[match];
  }
  return KERALA_DISTRICTS;
};

export const formatDistrictKerala = (address) => {
  if (!address || typeof address !== 'string' || !address.trim()) {
    return 'Kerala';
  }
  const clean = address.trim();

  // 1. Search for any exact Kerala district name
  for (const d of KERALA_DISTRICTS) {
    if (new RegExp('\\b' + d + '\\b', 'i').test(clean)) {
      return `${d}, Kerala`;
    }
  }

  // 2. If it already contains Kerala
  if (/kerala/i.test(clean)) {
    return clean;
  }

  // 3. Fallback: take the primary locality and append ", Kerala"
  const parts = clean.split(/[,-]/).map((p) => p.trim()).filter(Boolean);
  if (parts.length > 0) {
    const candidate = parts[parts.length - 1];
    return `${candidate}, Kerala`;
  }

  return 'Kerala';
};

/**
 * Parses an existing address string into { state, district, locality }
 */
export const parseAddress = (address) => {
  if (!address || typeof address !== 'string' || !address.trim()) {
    return { state: 'Kerala', district: 'Kozhikode', locality: '' };
  }

  const clean = address.trim();
  let foundState = 'Kerala';
  let foundDistrict = 'Kozhikode';

  // Check state match
  for (const s of INDIAN_STATES) {
    if (new RegExp('\\b' + s + '\\b', 'i').test(clean)) {
      foundState = s;
      break;
    }
  }

  // Check district match for that state
  const districts = getDistrictsForState(foundState);
  for (const d of districts) {
    if (new RegExp('\\b' + d + '\\b', 'i').test(clean)) {
      foundDistrict = d;
      break;
    }
  }

  // Strip district and state to get locality
  let locality = clean
    .replace(new RegExp('\\b' + foundDistrict + '\\b', 'gi'), '')
    .replace(new RegExp('\\b' + foundState + '\\b', 'gi'), '')
    .replace(/^[\s,.-]+|[\s,.-]+$/g, '')
    .replace(/,\s*,/g, ',')
    .trim();

  return { state: foundState, district: foundDistrict, locality };
};

/**
 * Formats locality, district, state into a single clean address string
 */
export const formatAddress = (locality, district, state) => {
  const loc = (locality || '').trim();
  const dist = (district || 'Kozhikode').trim();
  const st = (state || 'Kerala').trim();

  if (loc) {
    return `${loc}, ${dist}, ${st}`;
  }
  return `${dist}, ${st}`;
};
