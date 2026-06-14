import path from "node:path";

export const IMAGE_WIDTHS = [320, 640, 960, 1280];

export function normaliseImageInput(input) {
      if (!input) return "";

      if (typeof input === "string") {
              return input;
            }

      if (typeof input === "object") {
              return (
                        input.image ||
                        input.image_file ||
                        input.image_filename ||
                        input.thumbnail ||
                        ""
                      );
            }

      return "";
}

export function cleanImageFilename(input) {
      let image = normaliseImageInput(input);
      if (!image) return "";

      image = String(image).trim();
      image = image.split("?")[0].split("#")[0];

      return path.basename(image);
}

export function imageBaseName(input) {
      const filename = cleanImageFilename(input);
      if (!filename) return "";

      return filename.replace(/\.[^.]+$/, "");
}

export function imageDetailUrl(input) {
      const filename = cleanImageFilename(input);
      if (!filename) return "";

      return `/img/originals/${filename}`;
}

export function imageThumbUrl(input, width = 640) {
      const baseName = imageBaseName(input);
      if (!baseName) return "";

      return `/img/resized/${baseName}-${width}.webp`;
}

export function imageSrcset(input) {
      const baseName = imageBaseName(input);
      if (!baseName) return "";

      return IMAGE_WIDTHS
        .map((width) => `/img/resized/${baseName}-${width}.webp ${width}w`)
        .join(", ");
}
