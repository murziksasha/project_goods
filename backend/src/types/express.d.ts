import type { EmployeeDocument } from '../domain/employee/model';

declare global {
  namespace Express {
    interface Request {
      employee?: EmployeeDocument;
    }
  }
}

export {};