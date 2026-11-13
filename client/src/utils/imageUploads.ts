export function validateImageFiles(files: File[], maxFiles: number): string | null {
  if (files.length > maxFiles) return `이미지는 최대 ${maxFiles}장까지 첨부할 수 있습니다.`;
  const types: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp' };
  for (const file of files) {
    const extension = file.name.split('.').pop()?.toLowerCase() || '';
    if (!types[extension] || file.type !== types[extension]) return 'JPEG·PNG·WebP 이미지만 첨부할 수 있습니다.';
    if (!file.size || file.size > 5 * 1024 * 1024) return '이미지는 파일당 5MB 이하의 파일을 선택해주세요.';
  }
  if (files.reduce((bytes, file) => bytes + file.size, 0) > 25 * 1024 * 1024) return '첨부파일의 합계는 25MB 이하여야 합니다.';
  return null;
}
