import { useState, useEffect, useRef } from "react"
import {
    AreaSeries, LineSeries, CandlestickSeries, createChart, CrosshairMode,
    type AreaSeriesOptions, type CandlestickSeriesOptions, type ChartOptions,
    type DeepPartial, type IChartApi, type ISeriesApi, type UTCTimestamp
} from "lightweight-charts"

// ⬇️ NEW import syntax from indicatorts
import { sma } from "indicatorts"

type StockEntry = {
    time: UTCTimestamp
    open: number
    close: number
    high: number
    low: number
}

const Graph = (props: { data: StockEntry[], curr: string }) => {
    const [is_fin, setFin] = useState(true)
    const graph_class = (cond: boolean) =>
        "w-full h-[50vh] md:h-[calc(100vh-3rem)] " + (is_fin == cond ? "" : "hidden")

    const curr = useRef(props.curr)

    const smaSeriesRef = useRef<ISeriesApi<"Line"> | null>(null)
    const smaLineSeriesRef = useRef<ISeriesApi<"Line"> | null>(null)

    const finChartRef = useRef<IChartApi | null>(null)
    const lineChartRef = useRef<IChartApi | null>(null)

    const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null)
    const lineSeriesRef = useRef<ISeriesApi<"Area"> | null>(null)

    // INITIAL CHART SETUP
    useEffect(() => {
        if (!finChartRef.current) {
            const finChart = createChart(
                document.querySelector(`.graph div.fin`)! as HTMLElement,
                CHART_CONFIG
            )
            const candleSeries = finChart.addSeries(CandlestickSeries, CANDLESTICK_CONFIG)
            const smaSeries = finChart.addSeries(LineSeries, { color: "yellow", lineWidth: 1 })

            candleSeries.setData(props.data)

            finChartRef.current = finChart
            candleSeriesRef.current = candleSeries
            smaSeriesRef.current = smaSeries
        }

        if (!lineChartRef.current) {
            const lineChart = createChart(
                document.querySelector(`.graph div.line`)! as HTMLElement,
                CHART_CONFIG
            )
            const lineSeries = lineChart.addSeries(AreaSeries, LINE_CONFIG)
            const smaLineSeries = lineChart.addSeries(LineSeries, { color: "yellow", lineWidth: 1 })

            lineSeries.setData(props.data.map(d => ({ time: d.time, value: d.close })))

            lineChartRef.current = lineChart
            lineSeriesRef.current = lineSeries
            smaLineSeriesRef.current = smaLineSeries
        }

        return () => {
            finChartRef.current?.remove()
            lineChartRef.current?.remove()
            finChartRef.current = null
            lineChartRef.current = null
        }
    }, [])

    // SMA + LIVE UPDATE
    useEffect(() => {
        if (!props.data.length) return

        const closes = props.data.map(v => v.close)
        const times = props.data.map(v => v.time)

        // ⭐ Using indicatorts SMA function
        const smaResult = sma(closes, { period: 14 })

        const smaData = smaResult
            .map((value, idx) => value !== undefined
                ? { time: times[idx], value }
                : null
            )
            .filter(Boolean) as { time: UTCTimestamp, value: number }[]

        // Update base data
        candleSeriesRef.current?.setData(props.data)
        lineSeriesRef.current?.setData(
            props.data.map(v => ({ time: v.time, value: v.close }))
        )

        // Update SMA lines
        smaSeriesRef.current?.setData(smaData)
        smaLineSeriesRef.current?.setData(smaData)

        // Live update if same stock
        if (props.curr === curr.current) {
            const last = props.data.at(-1)!
            candleSeriesRef.current?.update(last)
            lineSeriesRef.current?.update({ time:last.time, value:last.close })

            const lastSMA = smaData.at(-1)
            if (lastSMA) {
                smaSeriesRef.current?.update(lastSMA)
                smaLineSeriesRef.current?.update(lastSMA)
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
    upColor: '#26a69a',
    downColor: '#ef5350',
    borderVisible: false,
    wickUpColor: '#26a69a',
    wickDownColor: '#ef5350',
}

const LINE_CONFIG: DeepPartial<AreaSeriesOptions> = {
    lineColor: '#2962FF',
    topColor: '#2962FF',
    bottomColor: 'rgba(41, 98, 255, 0.28)'
}

export default Graph



