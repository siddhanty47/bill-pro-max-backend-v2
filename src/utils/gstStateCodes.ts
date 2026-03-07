/**
 * @file GST State Codes
 * @description Map of 2-digit GST state codes to state/UT names (India)
 * Reference: GST portal / official GST state code list
 */

/** Map of 2-digit GST state code to state/UT name */
export const GST_STATE_CODE_MAP: Record<string, string> = {
  '01': 'Jammu and Kashmir',
  '02': 'Himachal Pradesh',
  '03': 'Punjab',
  '04': 'Chandigarh',
  '05': 'Uttarakhand',
  '06': 'Haryana',
  '07': 'Delhi',
  '08': 'Rajasthan',
  '09': 'Uttar Pradesh',
  '10': 'Bihar',
  '11': 'Sikkim',
  '12': 'Arunachal Pradesh',
  '13': 'Nagaland',
  '14': 'Manipur',
  '15': 'Mizoram',
  '16': 'Tripura',
  '17': 'Meghalaya',
  '18': 'Assam',
  '19': 'West Bengal',
  '20': 'Jharkhand',
  '21': 'Odisha',
  '22': 'Chhattisgarh',
  '23': 'Madhya Pradesh',
  '24': 'Gujarat',
  '26': 'Dadra and Nagar Haveli and Daman and Diu',
  '27': 'Maharashtra',
  '29': 'Karnataka',
  '30': 'Goa',
  '31': 'Lakshadweep',
  '32': 'Kerala',
  '33': 'Tamil Nadu',
  '34': 'Puducherry',
  '35': 'Andaman and Nicobar Islands',
  '36': 'Telangana',
  '37': 'Andhra Pradesh',
  '38': 'Ladakh',
  '97': 'Other Territory',
  '99': 'Other Countries',
};

/**
 * Get state/UT name from 2-digit GST state code.
 * @param code - 2-digit state code (e.g. "27" for Maharashtra)
 * @returns State name or empty string if code not found
 */
export function getStateNameFromCode(code: string | undefined): string {
  if (!code || typeof code !== 'string') return '';
  const normalized = code.trim().padStart(2, '0');
  return GST_STATE_CODE_MAP[normalized] ?? '';
}
