import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: any) {
  const num = typeof amount === 'number' ? amount : Number(amount);
  const safeAmount = isNaN(num) || num === null || num === undefined ? 0 : num;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
  }).format(safeAmount);
}

const COURSE_STOCK_IMAGES = [
  "https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?auto=format&fit=crop&q=80&w=800", // abstract glass physics
  "https://images.unsplash.com/photo-1509048191080-d2984bad6ad5?auto=format&fit=crop&q=80&w=800", // rainbow light prism
  "https://images.unsplash.com/photo-1544383335-9cd7318db9e9?auto=format&fit=crop&q=80&w=800", // gravity rings/orbits
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=800", // celestial science glow
  "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&q=80&w=800", // digital education tech
  "https://images.unsplash.com/photo-1635070041078-e363dbe005cb?auto=format&fit=crop&q=80&w=800", // geometric formula patterns
  "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&q=80&w=800", // minimal aesthetic wave 3D
  "https://images.unsplash.com/photo-1532187863486-abf9d39d66e8?auto=format&fit=crop&q=80&w=800", // vibrant chemistry research
];

const BANNER_STOCK_IMAGES = [
  "https://images.unsplash.com/photo-1636466497217-26a8cbeaf0aa?auto=format&fit=crop&q=80&w=1600",
  "https://images.unsplash.com/photo-1509048191080-d2984bad6ad5?auto=format&fit=crop&q=80&w=1600",
  "https://images.unsplash.com/photo-1544383335-9cd7318db9e9?auto=format&fit=crop&q=80&w=1600",
  "https://images.unsplash.com/photo-1451187580459-43490279c0fa?auto=format&fit=crop&q=80&w=1600"
];

export function getItemImage(title: string = '', subject: string = ''): string {
  const combined = (title + ' ' + subject).toLowerCase();
  
  if (combined.includes('quantum') || combined.includes('radiation') || combined.includes('atom') || combined.includes('particle')) {
    return COURSE_STOCK_IMAGES[1]; // prism
  }
  if (combined.includes('electromagnet') || combined.includes('maxwell') || combined.includes('magnetic') || combined.includes('charge')) {
    return COURSE_STOCK_IMAGES[3]; // glowing science energy
  }
  if (combined.includes('dynamic') || combined.includes('force') || combined.includes('motion') || combined.includes('mechanic') || combined.includes('gravity') || combined.includes('centripetal')) {
    return COURSE_STOCK_IMAGES[2]; // gravity rings
  }
  if (combined.includes('thermodynamic') || combined.includes('heat') || combined.includes('entropy')) {
    return COURSE_STOCK_IMAGES[6]; // beautiful minimal heat/wave shape
  }
  if (combined.includes('math') || combined.includes('equation') || combined.includes('geometry') || combined.includes('formula')) {
    return COURSE_STOCK_IMAGES[5]; // geometric math patterns
  }
  if (combined.includes('chemistry') || combined.includes('chemical') || combined.includes('reaction') || combined.includes('organic')) {
    return COURSE_STOCK_IMAGES[7]; // chemistry
  }
  
  // Deterministic selector by hashing title to always match the same image for a given title
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = combined.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % COURSE_STOCK_IMAGES.length;
  return COURSE_STOCK_IMAGES[index];
}

export function getBannerImage(title: string = '', subtitle: string = ''): string {
  const combined = (title + ' ' + subtitle).toLowerCase();
  if (combined.includes('quantum') || combined.includes('atom') || combined.includes('live')) {
    return BANNER_STOCK_IMAGES[1]; // prism glow
  }
  if (combined.includes('electromagnet') || combined.includes('maxwell') || combined.includes('charge')) {
    return BANNER_STOCK_IMAGES[3]; // celestial cosmic glow
  }
  if (combined.includes('dynamic') || combined.includes('force') || combined.includes('motion') || combined.includes('mechanic')) {
    return BANNER_STOCK_IMAGES[2]; // gravity loops
  }
  
  let hash = 0;
  for (let i = 0; i < combined.length; i++) {
    hash = combined.charCodeAt(i) + ((hash << 5) - hash);
  }
  const index = Math.abs(hash) % BANNER_STOCK_IMAGES.length;
  return BANNER_STOCK_IMAGES[index];
}

export function amountToWords(num: number): string {
  if (num === 0) return 'Zero Rupees';
  const a = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  
  const convertHundreds = (n: number): string => {
    if (n === 0) return '';
    let str = '';
    if (n >= 100) {
      str += a[Math.floor(n / 100)] + ' Hundred ';
      n %= 100;
    }
    if (n >= 20) {
      str += b[Math.floor(n / 10)] + ' ';
      n %= 10;
    }
    if (n > 0) {
      str += a[n] + ' ';
    }
    return str.trim();
  };

  try {
    let rawNum = Math.floor(num);
    if (rawNum === 0) return 'Zero Rupees';
    
    let result = '';
    
    // Crore
    if (rawNum >= 10000000) {
      const cr = Math.floor(rawNum / 10000000);
      result += convertHundreds(cr) + ' Crore ';
      rawNum %= 10000000;
    }
    
    // Lakh
    if (rawNum >= 100000) {
      const lk = Math.floor(rawNum / 100000);
      result += convertHundreds(lk) + ' Lakh ';
      rawNum %= 100000;
    }
    
    // Thousand
    if (rawNum >= 1000) {
      const th = Math.floor(rawNum / 1000);
      result += convertHundreds(th) + ' Thousand ';
      rawNum %= 1000;
    }
    
    // Hundreds/Tens/Ones
    if (rawNum > 0) {
      result += convertHundreds(rawNum);
    }
    
    return result.trim() + ' Rupees Only';
  } catch {
    return 'Rupees';
  }
}

