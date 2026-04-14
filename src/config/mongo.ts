import { connect } from 'mongoose';
import { MONGO_URI } from './envs';

export const dbConnect = () => {
  try {
    connect(MONGO_URI);
    console.log('###### DB Connected ######');
  } catch (error) {
    console.log('###### DB Connection Error ######');
    console.log(error);
  }
};
