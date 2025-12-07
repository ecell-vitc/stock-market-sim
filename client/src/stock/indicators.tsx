import type { StockEntry } from "../types";
import type { UTCTimestamp } from "lightweight-charts";

export default function calculateSMA(data: StockEntry[], period: number) {
    let result: { time: UTCTimestamp; value: number }[] = []

    for (let i = period - 1; i < data.length; i++) {
        let sum = 0

        for (let j = 0; j < period; j++) {
            sum += data[i - j].close
        }

        result.push({
            time: data[i].time,
            value: sum / period
        })
    }
    return result
}