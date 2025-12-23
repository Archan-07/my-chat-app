import { redisClient } from "./redis";

const get = async <T = unknown>(key: string): Promise<T | null> => {
  const data = await redisClient.get(key);
  if (!data) return null;
  try {
    return JSON.parse(data) as T;
  } catch (e) {
    return null;
  }
};

const set = async (key: string, value: unknown, ttlSeconds?: number) => {
  const str = JSON.stringify(value);
  if (typeof ttlSeconds === "number") {
    await redisClient.setEx(key, ttlSeconds, str);
  } else {
    await redisClient.set(key, str);
  }
};

const del = async (key: string) => {
  await redisClient.del(key);
};

export { get, set, del };
