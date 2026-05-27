export const textOrEmpty = (value) => String(value || "").trim();

export const listOrEmpty = (value) => {
  if (!value) return [];

  if (Array.isArray(value)) {
    return value.map((item) => textOrEmpty(item)).filter(Boolean);
  }

  return String(value)
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
};

export const parseChapterImages = (value) => {
  if (!value) return [];

  return String(value)
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [url, ...captionParts] = line.split("|");

      return {
        url: textOrEmpty(url),
        caption: textOrEmpty(captionParts.join("|"))
      };
    })
    .filter((image) => image.url);
};

export const assertNoUndefined = (value, path = "payload") => {
  if (value === undefined) {
    throw new Error(`Campo undefined detectado antes de guardar: ${path}`);
  }

  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoUndefined(item, `${path}[${index}]`));
    return;
  }

  if (value && typeof value === "object" && !(value instanceof Date)) {
    Object.entries(value).forEach(([key, entryValue]) => {
      assertNoUndefined(entryValue, `${path}.${key}`);
    });
  }
};

export const safeFirestorePayload = (payload) => {
  assertNoUndefined(payload);
  return payload;
};
