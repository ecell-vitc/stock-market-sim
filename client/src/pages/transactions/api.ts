import type { Transaction } from "../../types"

export const fetchTransactions = async (): Promise<Transaction[]> => {
  const res = await fetch("http://localhost:8000/user/transactions", {
    headers: {
      Authorization: `Bearer ${localStorage.getItem("token") ?? ""}`,
    },
  })

  if (!res.ok) {
    throw new Error("Failed to load transactions")
  }

  return await res.json() as Transaction[]
}
