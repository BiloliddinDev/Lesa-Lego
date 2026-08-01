import { IUser } from "../models/User";

declare global {
  namespace Express {
    interface Request {
      /**
       * authMiddleware tomonidan o'rnatiladi.
       * Route handler'larda har doim mavjud (agar authMiddleware dan o'tgan bo'lsa).
       */
      user: IUser;
    }
  }
}
