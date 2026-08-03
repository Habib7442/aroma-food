type ImagePlaceholderProps = {
  label: string;
  className?: string;
};

/**
 * Empty slot for photography that hasn't been produced yet.
 * Swap the wrapping element's children for a Next <Image> once the
 * matching file lands in public/images (see image prompt list).
 */
export function ImagePlaceholder({ label, className = "" }: ImagePlaceholderProps) {
  return (
    <div
      className={`flex items-center justify-center rounded-lg border border-dashed border-outline-variant bg-surface-container-high text-center ${className}`}
    >
      <span className="px-4 text-xs font-medium text-on-surface-variant">{label}</span>
    </div>
  );
}
