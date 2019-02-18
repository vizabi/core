import { DataFrame } from "../dataFrame";

export function order(df, direction, orderField = 'order') {
    const data = Array.from(df);

    data.sort((a, b) => {
        let ao = a[1][orderField],
            bo = b[1][orderField];

        return direction == directions.ascending ?
            ao - bo :
            bo - ao;
    });

    return DataFrame(data, df.key);
}