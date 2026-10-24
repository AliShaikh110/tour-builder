"use client";

import { useState } from "react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/api";
import { plural } from "@/lib/format";
import { baseName, importImage, isAcceptedImage, isEquirectangular, readImageSize } from "@/lib/image";
import { deleteMedia } from "@/lib/media-db";
import { useTourStore } from "@/lib/store";
import type { Scene } from "@/lib/types";

export interface SizedFile {
  file: File;
  width: number;
  height: number;
}

export interface UploadProgress {
  done: number;
  total: number;
  /** File being processed, or null while reading sizes. */
  current: string | null;
}

/** Non-2:1 images waiting for the user to choose "Use as 2D scene" or skip. */
export interface FlatImageQuestion {
  files: SizedFile[];
  mode: "add" | "swap";
  answer: (useAs2d: boolean) => void;
}

async function sizeFiles(files: File[]): Promise<{ sized: SizedFile[]; unreadable: number }> {
  const results = await Promise.all(
    files.map(async (file) => {
      try {
        return { file, ...(await readImageSize(file)) };
      } catch {
        return null;
      }
    }),
  );
  const sized = results.filter((r): r is SizedFile => r !== null);
  return { sized, unreadable: files.length - sized.length };
}

function rejectUnsupported(files: File[]): File[] {
  const accepted = files.filter(isAcceptedImage);
  const rejected = files.length - accepted.length;
  if (rejected) {
    toast.error(`Skipped ${plural(rejected, "file")}`, {
      description: "Only JPG, PNG and WebP photos are supported.",
    });
  }
  return accepted;
}

/** Adds scenes from files (and swaps a scene's image), with progress and the 2:1 check. */
export function useSceneUpload(tourId: string, onAdded?: (sceneIds: string[]) => void) {
  const addScenes = useTourStore((s) => s.addScenes);
  const updateScene = useTourStore((s) => s.updateScene);
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const [question, setQuestion] = useState<FlatImageQuestion | null>(null);

  function ask(files: SizedFile[], mode: FlatImageQuestion["mode"]): Promise<boolean> {
    return new Promise((resolve) => {
      setQuestion({
        files,
        mode,
        answer: (useAs2d) => {
          setQuestion(null);
          resolve(useAs2d);
        },
      });
    });
  }

  async function addFiles(input: Iterable<File>) {
    if (progress) {
      toast.info("Wait for the current upload to finish.");
      return;
    }
    const files = rejectUnsupported([...input]);
    if (files.length === 0) return;

    setProgress({ done: 0, total: files.length, current: null });
    const { sized, unreadable } = await sizeFiles(files);
    const flat = sized.filter((f) => !isEquirectangular(f.width, f.height));
    let useAs2d = false;
    if (flat.length) {
      setProgress(null);
      useAs2d = await ask(flat, "add");
    }
    const queue = sized.filter((f) => useAs2d || isEquirectangular(f.width, f.height));

    const added: string[] = [];
    let failed = unreadable;
    let uploadError: unknown = null;
    for (const [index, item] of queue.entries()) {
      setProgress({ done: index, total: queue.length, current: item.file.name });
      try {
        const panorama = isEquirectangular(item.width, item.height);
        const image = await importImage(tourId, item.file, {
          size: { width: item.width, height: item.height },
          displayType: panorama ? "360" : "2d",
        });
        added.push(...addScenes(tourId, [{ name: baseName(item.file.name), ...image }]));
      } catch (error) {
        failed += 1;
        uploadError = error;
      }
    }
    setProgress(null);

    const skipped = sized.length - queue.length;
    const reason = uploadError ? errorMessage(uploadError) : "";
    if (added.length) {
      toast.success(`Added ${plural(added.length, "scene")}`, {
        description:
          [
            skipped ? `${plural(skipped, "non-360° photo")} skipped.` : "",
            failed ? `${plural(failed, "photo")} couldn't be uploaded. ${reason}` : "",
          ]
            .filter(Boolean)
            .join(" ") || undefined,
      });
      onAdded?.(added);
    } else if (failed) {
      toast.error(`${plural(failed, "photo")} couldn't be uploaded`, { description: reason || undefined });
    }
  }

  /** Replaces a scene's image but keeps its name, hotspots and settings. */
  async function swapImage(scene: Scene, file: File) {
    if (progress) {
      toast.info("Wait for the current upload to finish.");
      return;
    }
    if (rejectUnsupported([file]).length === 0) return;
    setProgress({ done: 0, total: 1, current: file.name });
    const { sized } = await sizeFiles([file]);
    const item = sized[0];
    if (!item) {
      setProgress(null);
      toast.error(`Couldn't read ${file.name}`);
      return;
    }
    const panorama = isEquirectangular(item.width, item.height);
    if (!panorama) {
      setProgress(null);
      if (!(await ask([item], "swap"))) return;
      setProgress({ done: 0, total: 1, current: file.name });
    }
    try {
      const image = await importImage(tourId, file, {
        size: { width: item.width, height: item.height },
        displayType: panorama ? "360" : "2d",
      });
      const previous = updateScene(tourId, scene.id, image);
      if (previous) void deleteMedia(tourId, [previous.mediaKey, previous.thumbKey]).catch(() => undefined);
      toast.success(`Swapped the image of “${scene.name}”`, {
        description: "Its hotspots and settings were kept.",
      });
    } catch (error) {
      toast.error(`Couldn't upload ${file.name}`, { description: errorMessage(error) });
    } finally {
      setProgress(null);
    }
  }

  return { addFiles, swapImage, progress, question };
}

export type SceneUpload = ReturnType<typeof useSceneUpload>;
