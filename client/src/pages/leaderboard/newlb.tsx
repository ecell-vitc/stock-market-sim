import { useMemo } from "react"

type User = {
  name: string
  profit: number
}

const users: User[] = [
  { name: "Aarav Mehta", profit: 45200 },
  { name: "Sneha Reddy", profit: 38900 },
  { name: "Rahul Sharma", profit: 32150 },
  { name: "Karthik Iyer", profit: 28700 },
  { name: "Ananya Singh", profit: 15400 },
  { name: "Rohit Verma", profit: -4200 }
]

const Leaderboard = () => {
  const leaderboard = useMemo(
    () =>
      [...users]
        .sort((a, b) => b.profit - a.profit)
        .map((u, i) => ({ ...u, rank: i + 1 })),
    []
  )

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-b from-[#050617] via-gray-900 to-black text-gray-300">

      
      <div className="absolute inset-0 bg-[radial-gradient(1px_1px_at_20%_30%,white,transparent)] opacity-40 animate-pulse" />
      <div className="absolute inset-0 bg-[radial-gradient(1px_1px_at_70%_60%,white,transparent)] opacity-30 animate-ping" />
      <div className="absolute inset-0 bg-[radial-gradient(1px_1px_at_40%_80%,white,transparent)] opacity-20" />

      
      <div className="relative z-10 px-6 py-12">
        <div className="max-w-5xl mx-auto">

          
          <h1 className="text-4xl font-bold text-white mb-2 tracking-wide">
            Leaderboard
          </h1>
          <p className="text-gray-400 mb-8">
            Ranked by total profit in the stock market simulation
          </p>

          
          <div className="rounded-2xl border border-gray-700/50 bg-gray-800/60 backdrop-blur-xl shadow-2xl">

            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700 text-gray-400 text-sm">
                  <th className="p-5 text-left">Rank</th>
                  <th className="p-5 text-left">Trader</th>
                  <th className="p-5 text-right">Profit (₹)</th>
                </tr>
              </thead>

              <tbody>
                {leaderboard.map(user => (
                  <tr
                    key={user.rank}
                    className="border-b border-gray-700/50 hover:bg-gray-700/30 transition"
                  >
                    <td className="p-5 font-semibold">
                      {user.rank <= 3 ? (
                        <span className="text-[#9291ca]">#{user.rank}</span>
                      ) : (
                        <span className="text-gray-400">#{user.rank}</span>
                      )}
                    </td>

                    <td className="p-5 text-gray-200">
                      {user.name}
                    </td>

                    <td
                      className={`p-5 text-right font-semibold ${
                        user.profit >= 0
                          ? "text-emerald-400"
                          : "text-red-400"
                      }`}
                    >
                      {user.profit >= 0 ? "+" : ""}
                      {user.profit.toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>


          <p className="text-xs text-gray-500 mt-6">
            Profits update in real time as trades are executed
          </p>
        </div>
      </div>
    </div>
  )
}

export default Leaderboard