import type { EmployeeDocument } from '../domain/employee/model';

/** Augments Express Request for authenticated employee (must be imported from app entry). */
declare module 'express-serve-static-core' {
  interface Request {
    employee?: EmployeeDocument;
  }
}

export {};
