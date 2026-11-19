"use client";

import { useEffect, useId, useRef, useState } from "react";
import styles from "./staff.module.css";

/** Phone photos are often 4000 px wide and over 5 MB: they are scaled down before upload. */
const MAX_SIDE = 2000;
const QUALITY = 0.85;

async function shrink(file: File): Promise<File> {
  if (file.size < 1_500_000 || typeof createImageBitmap !== "function") return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", QUALITY));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file; // The server still checks size and type.
  }
}

type Props = { name: string; label: string; choose: string; change: string; hint: string; error?: React.ReactNode; ariaProps?: Record<string, unknown> };

/** Photo field: a clear button (gallery or camera on phones), a preview, and automatic resizing. */
export function PhotoPicker({ name, label, choose, change, hint, error, ariaProps }: Props) {
  const id = useId();
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");

  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);

  const onChange = async () => {
    const el = input.current;
    const picked = el?.files?.[0];
    if (!el || !picked) return;
    const file = await shrink(picked);
    if (file !== picked && typeof DataTransfer === "function") {
      const dt = new DataTransfer();
      dt.items.add(file);
      el.files = dt.files;
    }
    setFileName(`${file.name} · ${(file.size / 1_000_000).toFixed(1)} Mo`);
    setPreview(URL.createObjectURL(file));
  };

  return (
    <div className={styles.label}>
      <span>{label}</span>
      <input ref={input} id={id} className={styles.fileInput} name={name} type="file" accept="image/jpeg,image/png,image/webp" onChange={onChange} {...ariaProps} />
      <label htmlFor={id} className={styles.fileButton}>
        {preview ? change : choose}
      </label>
      {fileName && <span className={styles.muted}>{fileName}</span>}
      {/* eslint-disable-next-line @next/next/no-img-element -- local preview of the chosen photo */}
      {preview && <img className={styles.photoPreview} src={preview} alt="" />}
      <span className={styles.muted}>{hint}</span>
      {error}
    </div>
  );
}
