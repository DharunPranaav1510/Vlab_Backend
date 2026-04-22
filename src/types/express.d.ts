import { Request } from "express";

export interface AuthedRequest extends Request {
  user?: any;
  body: any;
  params: any;
  headers: any;
  cookies: any;
  file?: any;
}
