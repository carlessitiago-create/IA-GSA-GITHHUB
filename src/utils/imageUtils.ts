/**
 * Utility to transform various image URLs into direct image links
 * especially for Google Drive and other common sharing platforms.
 */
export const transformImageUrl = (url: string): string => {
  if (!url) return url;

  // Handle Google Drive links
  // Format: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
  // Format: https://drive.google.com/open?id=FILE_ID
  const driveMatch = url.match(/\/(?:d|open\?id)=([a-zA-Z0-9_-]+)/);
  if (driveMatch && (url.includes('drive.google.com') || url.includes('docs.google.com'))) {
    return `https://drive.google.com/uc?export=view&id=${driveMatch[1]}`;
  }

  // Handle share.google and photos.app.goo.gl links
  // These are common shorteners for Google Photos or Drive.
  if (url.includes('share.google/') || url.includes('photos.app.goo.gl/')) {
    // Return as is, components should use referrerPolicy="no-referrer"
    return url;
  }

  // Handle direct googleusercontent links (often used by Google Photos "Copy Image Address")
  if (url.includes('googleusercontent.com')) {
    return url;
  }

  return url;
};
