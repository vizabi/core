import { fullJoin } from "./fulljoin";

// use projection feature of full join
export const project = (df, projection) => fullJoin([{ dataFrame: df, projection: projection }]);