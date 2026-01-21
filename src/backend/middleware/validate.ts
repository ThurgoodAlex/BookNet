import mongoose from 'mongoose';
import { Request, Response, NextFunction } from 'express';

const isValidObjectId = (id: string) => mongoose.Types.ObjectId.isValid(id);

export function validateObjectId(paramName: string){
  return (req: Request, res: Response, next: NextFunction) => {
    const id = req.params[paramName];
    if (!id || !isValidObjectId(id as string)) {
      return res.status(400).json({ message: `Invalid book ID` });
    }
    next();
  };
};

