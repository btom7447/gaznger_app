// Mask email: first 2 letters + **** + last 2 letters
export const maskEmail = (email: string) => {
  const [name, domain] = email.split("@");
  if (!name || !domain) return email; // safety fallback

  if (name.length <= 2) {
    return name[0] + "*@" + domain;
  }

  const first2 = name.slice(0, 2);
  const last2 = name.slice(-2);
  const maskedMiddle = "*".repeat(name.length - 4);
  return `${first2}${maskedMiddle}${last2}@${domain}`;
};

// Mask phone: keep country code, show first 2 digits after code, mask middle, show last 3–4 digits
export const maskPhone = (phone: string) => {
  if (!phone) return "";

  // Remove non-digit characters for easier handling
  const digits = phone.replace(/\D/g, "");

  // If phone includes country code (like +2348034567890)
  const countryCodeMatch = phone.match(/^\+(\d{1,3})/);
  const countryCode = countryCodeMatch ? `+${countryCodeMatch[1]} ` : "";

  const localNumber = digits.slice(
    countryCodeMatch ? countryCodeMatch[1].length : 0
  );

  if (localNumber.length <= 6) {
    // very short number
    return countryCode + "*".repeat(localNumber.length);
  }

  const first2 = localNumber.slice(0, 2);
  const last3 = localNumber.slice(-3);
  return `${countryCode}${first2}* **** ${last3}`;
};
