import crypto from "node:crypto";
import bcrypt from "bcryptjs";
import jwt, { type SignOptions } from "jsonwebtoken";
import { isValidObjectId, Types } from "mongoose";
import nodemailer from "nodemailer";

import { env } from "../config/env";
import { AppError } from "../middleware/errorHandler";
import { PetModel } from "../models/Pet";
import { UserModel, type IUser, type UserDocument } from "../models/User";

const BCRYPT_ROUNDS = 12;
const EMAIL_CONFIRMATION_TOKEN_TTL_MS = 24 * 60 * 60 * 1000;
const PASSWORD_RESET_TOKEN_TTL_MS = 60 * 60 * 1000;
const PASSWORD_RESET_VALIDATION_EXTENSION_MS = 15 * 60 * 1000;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export interface RegisterInput {
  email?: unknown;
  password?: unknown;
  personalDataConsent?: unknown;
}

export interface LoginInput {
  email?: unknown;
  password?: unknown;
}

export interface PasswordResetRequestInput {
  email?: unknown;
}

export interface PasswordResetConfirmInput {
  token?: unknown;
  password?: unknown;
}

export interface PasswordResetValidateInput {
  token?: unknown;
}

export interface SafeAuthUser {
  id: string;
  email: string;
  emailVerified: boolean;
}

export type NextStep = "onboarding" | null;

export interface AuthResult {
  accessToken: string;
  user: SafeAuthUser;
  nextStep: NextStep;
}

export type RegisterResult = AuthResult;
export type LoginResult = AuthResult;
export type EmailConfirmationResult = AuthResult;

export interface EmailConfirmInput {
  token?: unknown;
}

export interface ConfirmationEmailPayload {
  to: string;
  confirmationUrl: string;
}

interface CreateUserInput {
  email: string;
  passwordHash: string;
  status: "active";
  emailVerified: boolean;
  verificationTokenHash: string;
  verificationTokenExpiresAt: Date;
  consentAcceptedAt: Date;
}

type ConfirmationUser = Pick<
  UserDocument,
  | "_id"
  | "email"
  | "emailVerified"
  | "verificationTokenExpiresAt"
  | "verificationTokenHash"
  | "save"
>;

type LoginUser = Pick<IUser, "_id" | "email" | "emailVerified" | "passwordHash">;

type PasswordResetRequestUser = Pick<
  UserDocument,
  "email" | "resetTokenHash" | "resetTokenExpiresAt" | "save"
>;

type EmailConfirmationResendUser = Pick<
  UserDocument,
  "email" | "emailVerified" | "verificationTokenHash" | "verificationTokenExpiresAt" | "save"
>;

type PasswordResetConfirmUser = Pick<
  UserDocument,
  "passwordHash" | "resetTokenHash" | "resetTokenExpiresAt" | "save"
>;

export interface PasswordResetEmailPayload {
  to: string;
  resetUrl: string;
}

export interface AuthServiceDependencies {
  findUserByEmail?: (email: string) => Promise<unknown>;
  createUser?: (input: CreateUserInput) => Promise<Pick<IUser, "_id" | "email" | "emailVerified">>;
  findUserByVerificationTokenHash?: (tokenHash: string) => Promise<ConfirmationUser | null>;
  findEmailConfirmationResendUserById?: (
    id: Types.ObjectId
  ) => Promise<EmailConfirmationResendUser | null>;
  findLoginUserByEmail?: (email: string) => Promise<LoginUser | null>;
  findPasswordResetUserByEmail?: (email: string) => Promise<PasswordResetRequestUser | null>;
  findUserByResetTokenHash?: (tokenHash: string) => Promise<PasswordResetConfirmUser | null>;
  hasPetsForOwner?: (ownerId: Types.ObjectId) => Promise<boolean>;
  generateToken?: () => string;
  hashPassword?: (password: string) => Promise<string>;
  comparePassword?: (password: string, hash: string) => Promise<boolean>;
  signJwt?: (payload: JwtPayload) => string;
  sendConfirmationEmail?: (payload: ConfirmationEmailPayload) => Promise<void>;
  sendPasswordResetEmail?: (payload: PasswordResetEmailPayload) => Promise<void>;
  now?: () => Date;
  awaitConfirmationEmail?: boolean;
  awaitPasswordResetEmail?: boolean;
}

interface JwtPayload {
  sub: string;
  email: string;
}

export const normalizeEmail = (email: string): string => email.trim().toLowerCase();

export const hashToken = (token: string): string => {
  return crypto.createHash("sha256").update(token).digest("hex");
};

const defaultGenerateToken = (): string => crypto.randomBytes(32).toString("base64url");

const defaultHashPassword = (password: string): Promise<string> => bcrypt.hash(password, BCRYPT_ROUNDS);

const defaultComparePassword = (password: string, hash: string): Promise<boolean> =>
  bcrypt.compare(password, hash);

const defaultHasPetsForOwner = async (ownerId: Types.ObjectId): Promise<boolean> => {
  const existing = await PetModel.exists({ ownerId }).exec();
  return existing !== null;
};

const defaultSignJwt = (payload: JwtPayload): string => {
  const options: SignOptions = {
    expiresIn: env.JWT_EXPIRES_IN as SignOptions["expiresIn"]
  };

  return jwt.sign(payload, env.JWT_SECRET, options);
};

const buildConfirmationUrl = (token: string): string => {
  const url = new URL("/auth/email-confirmed", env.FRONTEND_URL);
  url.searchParams.set("token", token);
  return url.toString();
};

const buildPasswordResetUrl = (token: string): string => {
  const url = new URL("/auth/password-reset", env.FRONTEND_URL);
  url.searchParams.set("token", token);
  return url.toString();
};

const defaultSendConfirmationEmail = async ({
  to,
  confirmationUrl
}: ConfirmationEmailPayload): Promise<void> => {
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASSWORD
    }
  });

  await transporter.sendMail({
    from: `Команда Pawsport <${env.SMTP_FROM}>`,
    to,
    subject: "Подтвердите email в Pawsport",
    text: [
      "Здравствуйте!",
      "",
      "Подтвердите email, чтобы включить автоматические email-уведомления Pawsport.",
      confirmationUrl,
      "",
      "Если вы не регистрировались в Pawsport, просто проигнорируйте это письмо."
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; color: #202124; line-height: 1.55;">
        <h1 style="font-size: 22px; margin: 0 0 16px;">Подтвердите email в Pawsport</h1>
        <p>Здравствуйте!</p>
        <p>Подтвердите email, чтобы включить автоматические email-уведомления Pawsport.</p>
        <p><a href="${confirmationUrl}">Подтвердить email</a></p>
        <p style="color: #5f6368;">Если вы не регистрировались в Pawsport, просто проигнорируйте это письмо.</p>
      </div>
    `
  });
};

const validatePasswordStrength = (password: unknown): string => {
  if (typeof password !== "string") {
    throw new AppError(400, "INVALID_PASSWORD", "Password is required");
  }

  if (password.length < 8) {
    throw new AppError(
      400,
      "INVALID_PASSWORD",
      "Password must be at least 8 characters long"
    );
  }

  return password;
};

const validateRegistrationInput = (input: RegisterInput): { email: string; password: string } => {
  if (typeof input.email !== "string") {
    throw new AppError(400, "INVALID_EMAIL", "Email is required");
  }

  const email = normalizeEmail(input.email);

  if (!emailPattern.test(email)) {
    throw new AppError(400, "INVALID_EMAIL", "Email must be a valid email address");
  }

  const password = validatePasswordStrength(input.password);

  if (input.personalDataConsent !== true) {
    throw new AppError(400, "PERSONAL_DATA_CONSENT_REQUIRED", "Personal data consent is required");
  }

  return { email, password };
};

const parseEmailInput = (input: { email?: unknown }): string => {
  if (typeof input.email !== "string") {
    throw new AppError(400, "INVALID_EMAIL", "Email is required");
  }

  const email = normalizeEmail(input.email);

  if (!emailPattern.test(email)) {
    throw new AppError(400, "INVALID_EMAIL", "Email must be a valid email address");
  }

  return email;
};

const toSafeUser = (user: Pick<IUser, "_id" | "email" | "emailVerified">): SafeAuthUser => ({
  id: user._id.toString(),
  email: user.email,
  emailVerified: user.emailVerified
});

const sendEmailSafely = async (
  sender: (payload: ConfirmationEmailPayload) => Promise<void>,
  payload: ConfirmationEmailPayload
): Promise<void> => {
  try {
    await sender(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown SMTP error";
    process.stderr.write(`Failed to send confirmation email: ${message}\n`);
  }
};

const defaultSendPasswordResetEmail = async ({
  to,
  resetUrl
}: PasswordResetEmailPayload): Promise<void> => {
  const transporter = nodemailer.createTransport({
    host: env.SMTP_HOST,
    port: env.SMTP_PORT,
    secure: env.SMTP_SECURE,
    auth: {
      user: env.SMTP_USER,
      pass: env.SMTP_PASSWORD
    }
  });

  await transporter.sendMail({
    from: `Команда Pawsport <${env.SMTP_FROM}>`,
    to,
    subject: "Сброс пароля в Pawsport",
    text: [
      "Здравствуйте!",
      "",
      "Мы получили запрос на сброс пароля для вашего аккаунта Pawsport.",
      "Чтобы задать новый пароль, перейдите по ссылке (она действительна один час):",
      resetUrl,
      "",
      "Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо."
    ].join("\n"),
    html: `
      <div style="font-family: Arial, sans-serif; color: #202124; line-height: 1.55;">
        <h1 style="font-size: 22px; margin: 0 0 16px;">Сброс пароля в Pawsport</h1>
        <p>Здравствуйте!</p>
        <p>Мы получили запрос на сброс пароля для вашего аккаунта Pawsport.</p>
        <p>Чтобы задать новый пароль, перейдите по ссылке (она действительна один час):</p>
        <p><a href="${resetUrl}">Сбросить пароль</a></p>
        <p style="color: #5f6368;">Если вы не запрашивали сброс пароля, просто проигнорируйте это письмо.</p>
      </div>
    `
  });
};

const sendPasswordResetEmailSafely = async (
  sender: (payload: PasswordResetEmailPayload) => Promise<void>,
  payload: PasswordResetEmailPayload
): Promise<void> => {
  try {
    await sender(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown SMTP error";
    process.stderr.write(`Failed to send password reset email: ${message}\n`);
  }
};

export const registerUser = async (
  input: RegisterInput,
  dependencies: AuthServiceDependencies = {}
): Promise<RegisterResult> => {
  const {
    findUserByEmail = async (email) => UserModel.findOne({ email }).exec(),
    createUser = async (userInput) => UserModel.create(userInput),
    generateToken = defaultGenerateToken,
    hashPassword = defaultHashPassword,
    signJwt = defaultSignJwt,
    sendConfirmationEmail = defaultSendConfirmationEmail,
    now = () => new Date(),
    awaitConfirmationEmail = false
  } = dependencies;

  const { email, password } = validateRegistrationInput(input);
  const existingUser = await findUserByEmail(email);

  if (existingUser) {
    throw new AppError(409, "EMAIL_ALREADY_EXISTS", "User with this email already exists");
  }

  const passwordHash = await hashPassword(password);
  const confirmationToken = generateToken();
  const verificationTokenHash = hashToken(confirmationToken);
  const createdAt = now();
  const verificationTokenExpiresAt = new Date(createdAt.getTime() + EMAIL_CONFIRMATION_TOKEN_TTL_MS);

  let user: Pick<IUser, "_id" | "email" | "emailVerified">;

  try {
    user = await createUser({
      email,
      passwordHash,
      status: "active",
      emailVerified: false,
      verificationTokenHash,
      verificationTokenExpiresAt,
      consentAcceptedAt: createdAt
    });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === 11000) {
      throw new AppError(409, "EMAIL_ALREADY_EXISTS", "User with this email already exists");
    }

    throw error;
  }

  const emailPayload = {
    to: email,
    confirmationUrl: buildConfirmationUrl(confirmationToken)
  };

  const emailTask = sendEmailSafely(sendConfirmationEmail, emailPayload);

  if (awaitConfirmationEmail) {
    await emailTask;
  } else {
    void emailTask;
  }

  const safeUser = toSafeUser(user);

  return {
    accessToken: signJwt({
      sub: safeUser.id,
      email: safeUser.email
    }),
    user: safeUser,
    nextStep: "onboarding"
  };
};

export const resendConfirmationEmail = async (
  userId: string,
  dependencies: AuthServiceDependencies = {}
): Promise<void> => {
  const {
    findEmailConfirmationResendUserById = async (id) =>
      UserModel.findById(id).exec() as Promise<EmailConfirmationResendUser | null>,
    generateToken = defaultGenerateToken,
    sendConfirmationEmail = defaultSendConfirmationEmail,
    now = () => new Date(),
    awaitConfirmationEmail = false
  } = dependencies;

  if (!isValidObjectId(userId)) {
    throw new AppError(401, "UNAUTHORIZED", "Invalid access token");
  }

  const user = await findEmailConfirmationResendUserById(new Types.ObjectId(userId));

  if (!user) {
    throw new AppError(404, "USER_NOT_FOUND", "User was not found");
  }

  if (user.emailVerified) {
    return;
  }

  const confirmationToken = generateToken();
  user.verificationTokenHash = hashToken(confirmationToken);
  user.verificationTokenExpiresAt = new Date(now().getTime() + EMAIL_CONFIRMATION_TOKEN_TTL_MS);
  await user.save();

  const emailTask = sendEmailSafely(sendConfirmationEmail, {
    to: user.email,
    confirmationUrl: buildConfirmationUrl(confirmationToken)
  });

  if (awaitConfirmationEmail) {
    await emailTask;
  } else {
    void emailTask;
  }
};

const invalidConfirmationTokenError = (): AppError =>
  new AppError(
    400,
    "INVALID_CONFIRMATION_TOKEN",
    "Email confirmation token is invalid or has expired"
  );

export const confirmEmail = async (
  input: EmailConfirmInput,
  dependencies: AuthServiceDependencies = {}
): Promise<EmailConfirmationResult> => {
  const {
    findUserByVerificationTokenHash = async (tokenHash) =>
      UserModel.findOne({ verificationTokenHash: tokenHash }).exec(),
    hasPetsForOwner = defaultHasPetsForOwner,
    signJwt = defaultSignJwt,
    now = () => new Date()
  } = dependencies;

  if (typeof input.token !== "string" || input.token.trim().length === 0) {
    throw invalidConfirmationTokenError();
  }

  const tokenHash = hashToken(input.token);
  const user = await findUserByVerificationTokenHash(tokenHash);

  if (
    !user ||
    user.emailVerified ||
    !user.verificationTokenExpiresAt ||
    user.verificationTokenExpiresAt.getTime() <= now().getTime()
  ) {
    throw invalidConfirmationTokenError();
  }

  user.emailVerified = true;
  user.verificationTokenHash = undefined;
  user.verificationTokenExpiresAt = undefined;
  await user.save();

  const safeUser = toSafeUser(user);
  const nextStep: NextStep = (await hasPetsForOwner(user._id)) ? null : "onboarding";

  return {
    accessToken: signJwt({
      sub: safeUser.id,
      email: safeUser.email
    }),
    user: safeUser,
    nextStep
  };
};

const validateLoginInput = (input: LoginInput): { email: string; password: string } => {
  if (typeof input.email !== "string" || typeof input.password !== "string") {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  const email = normalizeEmail(input.email);

  if (!emailPattern.test(email) || input.password.length === 0) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  return { email, password: input.password };
};

export const loginUser = async (
  input: LoginInput,
  dependencies: AuthServiceDependencies = {}
): Promise<LoginResult> => {
  const {
    findLoginUserByEmail = async (email) =>
      UserModel.findOne({ email }).select("+passwordHash").exec() as Promise<LoginUser | null>,
    comparePassword = defaultComparePassword,
    hasPetsForOwner = defaultHasPetsForOwner,
    signJwt = defaultSignJwt
  } = dependencies;

  const { email, password } = validateLoginInput(input);
  const user = await findLoginUserByEmail(email);

  if (!user) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  const passwordMatches = await comparePassword(password, user.passwordHash);

  if (!passwordMatches) {
    throw new AppError(401, "INVALID_CREDENTIALS", "Invalid email or password");
  }

  const safeUser = toSafeUser(user);
  const nextStep: NextStep = (await hasPetsForOwner(user._id)) ? null : "onboarding";

  return {
    accessToken: signJwt({
      sub: safeUser.id,
      email: safeUser.email
    }),
    user: safeUser,
    nextStep
  };
};

const parsePasswordResetEmail = (input: PasswordResetRequestInput): string => {
  return parseEmailInput(input);
};

export const requestPasswordReset = async (
  input: PasswordResetRequestInput,
  dependencies: AuthServiceDependencies = {}
): Promise<void> => {
  const {
    findPasswordResetUserByEmail = async (email) =>
      UserModel.findOne({ email }).exec() as Promise<PasswordResetRequestUser | null>,
    generateToken = defaultGenerateToken,
    sendPasswordResetEmail = defaultSendPasswordResetEmail,
    now = () => new Date(),
    awaitPasswordResetEmail = false
  } = dependencies;

  const email = parsePasswordResetEmail(input);
  const resetToken = generateToken();
  const resetTokenHash = hashToken(resetToken);
  const resetTokenExpiresAt = new Date(now().getTime() + PASSWORD_RESET_TOKEN_TTL_MS);
  const user = await findPasswordResetUserByEmail(email);

  if (!user) {
    return;
  }

  user.resetTokenHash = resetTokenHash;
  user.resetTokenExpiresAt = resetTokenExpiresAt;
  await user.save();

  const emailPayload: PasswordResetEmailPayload = {
    to: user.email,
    resetUrl: buildPasswordResetUrl(resetToken)
  };

  const emailTask = sendPasswordResetEmailSafely(sendPasswordResetEmail, emailPayload);

  if (awaitPasswordResetEmail) {
    await emailTask;
  } else {
    void emailTask;
  }
};

const validatePasswordResetConfirmInput = (
  input: PasswordResetConfirmInput
): { token: string; password: string } => {
  if (typeof input.token !== "string" || input.token.trim().length === 0) {
    throw new AppError(400, "INVALID_RESET_TOKEN", "Reset token is invalid or has expired");
  }

  const password = validatePasswordStrength(input.password);

  return { token: input.token, password };
};

const parseResetToken = (input: PasswordResetValidateInput): string => {
  if (typeof input.token !== "string" || input.token.trim().length === 0) {
    throw new AppError(400, "INVALID_RESET_TOKEN", "Reset token is invalid or has expired");
  }

  return input.token;
};

export const validatePasswordResetToken = async (
  input: PasswordResetValidateInput,
  dependencies: AuthServiceDependencies = {}
): Promise<void> => {
  const {
    findUserByResetTokenHash = async (tokenHash) =>
      UserModel.findOne({ resetTokenHash: tokenHash }).exec() as Promise<PasswordResetConfirmUser | null>,
    now = () => new Date()
  } = dependencies;

  const token = parseResetToken(input);
  const tokenHash = hashToken(token);
  const user = await findUserByResetTokenHash(tokenHash);
  const currentTime = now().getTime();

  if (!user || !user.resetTokenExpiresAt || user.resetTokenExpiresAt.getTime() <= currentTime) {
    throw new AppError(400, "INVALID_RESET_TOKEN", "Reset token is invalid or has expired");
  }

  const minimumExpiry = currentTime + PASSWORD_RESET_VALIDATION_EXTENSION_MS;
  if (user.resetTokenExpiresAt.getTime() < minimumExpiry) {
    user.resetTokenExpiresAt = new Date(minimumExpiry);
    await user.save();
  }
};

export const confirmPasswordReset = async (
  input: PasswordResetConfirmInput,
  dependencies: AuthServiceDependencies = {}
): Promise<void> => {
  const {
    findUserByResetTokenHash = async (tokenHash) =>
      UserModel.findOne({ resetTokenHash: tokenHash }).exec() as Promise<PasswordResetConfirmUser | null>,
    hashPassword = defaultHashPassword,
    now = () => new Date()
  } = dependencies;

  const { token, password } = validatePasswordResetConfirmInput(input);
  const tokenHash = hashToken(token);
  const user = await findUserByResetTokenHash(tokenHash);

  if (!user || !user.resetTokenExpiresAt || user.resetTokenExpiresAt.getTime() <= now().getTime()) {
    throw new AppError(400, "INVALID_RESET_TOKEN", "Reset token is invalid or has expired");
  }

  user.passwordHash = await hashPassword(password);
  user.resetTokenHash = undefined;
  user.resetTokenExpiresAt = undefined;
  await user.save();
};
