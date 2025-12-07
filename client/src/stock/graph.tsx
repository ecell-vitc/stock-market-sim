import { useState, useEffect, useRef } from "react"
import {
    AreaSeries, LineSeries, CandlestickSeries, createChart, CrosshairMode,
    type AreaSeriesOptions, type CandlestickSeriesOptions, type ChartOptions,
    type DeepPartial, type IChartApi, type ISeriesApi, type UTCTimestamp
} from "lightweight-charts"

type StockEntry = {
    time: UTCTimestamp
    open: number; close: number
    high: number; low: number
}

import calculateSMA from "./indicators"; // Import the SMA calculation function

const Graph = (props: { data: StockEntry[], curr: string }) => {
    const [is_fin, setFin] = useState(true)
    const graph_class = (cond: boolean) => "w-full h-[50vh] md:h-[calc(100vh-3rem)] " + (is_fin == cond ? "" : "hidden")

    const curr = useRef(props.curr)


    //SMA Indicator Reference
    const smaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null)
    const smaLineSeriesRef = useRef<ISeriesApi<"Line"> | null>(null) // ✅ for Line chart


    const finChartRef = useRef<IChartApi | null>(null),
        lineChartRef = useRef<IChartApi | null>(null)

    const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null),
        lineSeriesRef = useRef<ISeriesApi<"Area"> | null>(null)

    useEffect(() => {
        if (!finChartRef.current) {
            const finChart = createChart(document.querySelector(`.graph div.fin`)! as HTMLElement, CHART_CONFIG)
            const candleSeries = finChart.addSeries(CandlestickSeries, CANDLESTICK_CONFIG)

            // ✅✅✅ THIS IS YOUR SMA LINE ✅✅✅
            const smaSeries = finChart.addSeries(LineSeries, {
                color: "yellow",
                lineWidth: 1,
            })

            candleSeries.setData(props.data)

            finChartRef.current = finChart
            candleSeriesRef.current = candleSeries

            smaSeriesRef.current = smaSeries   // ✅ STORE SMA
        }

        if (!lineChartRef.current) {
            const lineChart = createChart(document.querySelector(`.graph div.line`)! as HTMLElement, CHART_CONFIG)
            const lineSeries = lineChart.addSeries(AreaSeries, LINE_CONFIG)
            const smaLineSeries = lineChart.addSeries(LineSeries, {
                color: "yellow",
                lineWidth: 1,
            })
            lineSeries.setData(props.data.map((elem) => ({ time: elem.time, value: elem.close })))

            lineChartRef.current = lineChart
            lineSeriesRef.current = lineSeries

            smaLineSeriesRef.current = smaLineSeries // ✅ STORE SMA for Line chart
        }

        return () => {
            if (finChartRef.current) {
                finChartRef.current.remove()
                finChartRef.current = null
            }

            if (lineChartRef.current) {
                lineChartRef.current.remove()
                lineChartRef.current = null
            }
        }
    }, [])

    useEffect(() => {
        const smaData = calculateSMA(props.data, 14);

        // ✅✅✅ ALWAYS SET FULL DATA FIRST ✅✅✅
        candleSeriesRef.current?.setData(props.data)

        lineSeriesRef.current?.setData(
            props.data.map((elem) => ({
                time: elem.time,
                value: elem.close
            }))
        )

        smaSeriesRef.current?.setData(smaData)   // ✅ ALWAYS DRAW SMA
        smaLineSeriesRef.current?.setData(smaData)  // ✅ for Line chart
        // ✅ Handle live update optimization
        if (props.curr === curr.current) {
            const last = props.data[props.data.length - 1]
            candleSeriesRef.current?.update(last)
            lineSeriesRef.current?.update({
                time: last.time,
                value: last.close
            })
            const latestSMA = smaData[smaData.length - 1]
            if (latestSMA) {
                smaSeriesRef.current?.update(latestSMA)
                smaLineSeriesRef.current?.update(latestSMA) // ✅ for Line chart
            }
        }
        curr.current = props.curr
    }, [props.data, props.curr])


    return (
        <div className="graph relative">
            <div className="absolute w-full z-[3] top-3">
                <button disabled={is_fin} onClick={() => setFin(true)} className="mx-3 text-white">Candlestick</button>
                <button disabled={!is_fin} onClick={() => setFin(false)} className="mx-3 text-white">Line</button>
            </div>
            <div className={"fin " + graph_class(true)}></div>
            <div className={"line " + graph_class(false)}></div>
        </div>
    )
}

const CHART_CONFIG: DeepPartial<ChartOptions> = {
    autoSize: true,
    layout: { textColor: 'white', background: { color: 'black' } },
    grid: { vertLines: { color: '#222' }, horzLines: { color: '#222' } },
    crosshair: { mode: CrosshairMode.Hidden },
    timeScale: { visible: false }
}

const CANDLESTICK_CONFIG: DeepPartial<CandlestickSeriesOptions> = {
    upColor: '#26a69a', downColor: '#ef5350', borderVisible: false,
    wickUpColor: '#26a69a', wickDownColor: '#ef5350',
}

const LINE_CONFIG: DeepPartial<AreaSeriesOptions> = {
    lineColor: '#2962FF', topColor: '#2962FF',
    bottomColor: 'rgba(41, 98, 255, 0.28)'
}

export default Graph