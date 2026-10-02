import { useState } from "react";
import { initials } from "@/lib/feed-utils";

type SafeAvatarProps = {
  src?: string | null;
  name?: string | null;
  alt?: string;
  className?: string;
  imageClassName?: string;
  fallbackClassName?: string;
};

export default function SafeAvatar({
  src,
  name,
  alt,
  className = "",
  imageClassName = "",
  fallbackClassName = "text-xs font-black text-purple-500",
}: SafeAvatarProps) {
  const [failed, setFailed] = useState(false);
  const canShowImage = Boolean(src) && !failed;

  return (
    <div className={`relative flex items-center justify-center overflow-hidden ${className}`}>
      {canShowImage ? (
        <img
          src={src || ""}
          alt={alt || name || "Avatar"}
          className={`absolute inset-0 h-full w-full object-cover ${imageClassName}`}
          onError={() => setFailed(true)}
          draggable={false}
        />
      ) : (
        <span className={fallbackClassName}>{initials(name || "Atleta")}</span>
      )}
    </div>
  );
}
