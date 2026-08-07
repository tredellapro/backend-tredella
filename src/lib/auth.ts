import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { GraphQLError } from "graphql";
import type { Role } from "./constants.js";

const JWT_SECRET = process.env.JWT_SECRET ?? "dev-secret";

export type JwtPayload = { userId: string; role: Role };

export const signToken = (payload: JwtPayload) =>
  jwt.sign(payload, JWT_SECRET, { expiresIn: "30d" });

export const verifyToken = (token: string): JwtPayload | null => {
  try {
    return jwt.verify(token, JWT_SECRET) as JwtPayload;
  } catch {
    return null;
  }
};

export const hashPassword = (password: string) => bcrypt.hash(password, 10);

export const comparePassword = (password: string, hash: string) =>
  bcrypt.compare(password, hash);


export const unauthenticated = () =>
  new GraphQLError("You must be signed in to do this.", {
    extensions: { code: "UNAUTHENTICATED" },
  });

export const forbidden = (message = "Not allowed.") =>
  new GraphQLError(message, { extensions: { code: "FORBIDDEN" } });

export const badInput = (message: string) =>
  new GraphQLError(message, { extensions: { code: "BAD_USER_INPUT" } });
