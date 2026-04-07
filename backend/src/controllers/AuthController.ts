import type { Request, Response } from "express";
import { firebaseLogin, firebaseRegister } from "../services/firebaseAuthService";

export class AuthController {
  static async login(req: Request, res: Response) {
    const { email, password } = req.body;
    const result = await firebaseLogin(email, password);
    if (result.success) {
      return res.json(result.data);
    }
    return res
      .status(result.status ?? 500)
      .json({ error: result.message, details: result.details });
  }

  static async register(req: Request, res: Response) {
    const { email, password, firstName, lastName } = req.body;
    const result = await firebaseRegister(email, password, firstName, lastName);
    if (result.success) {
      return res.json(result.data);
    }
    return res
      .status(result.status ?? 500)
      .json({ error: result.message, details: result.details });
  }
}
