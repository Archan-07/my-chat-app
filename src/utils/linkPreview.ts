import axios from "axios";
import * as cheerio from "cheerio";
import Logger from "./logger";

interface LinkPreviewData {
  url: string;
  title?: string;
  description?: string;
  image?: string;
}

export const getLinkPreview = async (
  text: string
): Promise<LinkPreviewData | null> => {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const match = text.match(urlRegex);

  if (!match) return null;

  const url = match[0];

  try {
    const { data } = await axios.get(url, {
      timeout: 3000,
      headers: { "User-Agent": "Bot" },
    });

    const $ = cheerio.load(data);
    const title =
      $('meta[property="og:title"]').attr("content") || $("title").text();

    const description =
      $('meta[property="og:description"]').attr("content") ||
      $('meta[name="description"]').attr("content");

    const image = $('meta[property="og:image"]').attr("content");

    if (!title && !description && !image) return null;

    return { url, title, description, image };
  } catch (error) {
    Logger.warn(`Failed to generate link preview for ${url}`);
    return null;
  }
};
