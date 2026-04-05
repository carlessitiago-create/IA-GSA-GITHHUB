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

  // Handle share.google links
  // These often need to be resolved, but if they provide a direct path we can try to guess.
  // For now, we'll just return as is unless we find a specific pattern.

  return url;
};
