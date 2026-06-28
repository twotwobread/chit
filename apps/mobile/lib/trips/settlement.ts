export type SettlementParticipant = {
  id: string;
  name: string;
};

export type SettlementExpense = {
  amount: number;
  payerParticipantId: string;
  splitParticipantIds?: string[];
};

export type SettlementBalance = {
  participantId: string;
  name: string;
  paidAmount: number;
  shareAmount: number;
  netAmount: number;
};

export type SettlementTransfer = {
  fromParticipantId: string;
  fromName: string;
  toParticipantId: string;
  toName: string;
  amount: number;
};

export function computeSettlementBalances({
  expenses,
  participants,
}: {
  participants: SettlementParticipant[];
  expenses: SettlementExpense[];
}): SettlementBalance[] {
  const balances = participants.map((participant) => ({
    name: participant.name,
    paidAmount: 0,
    participantId: participant.id,
    shareAmount: 0,
  }));
  const indexById = new Map(balances.map((balance, index) => [balance.participantId, index]));

  for (const expense of expenses) {
    const payerIndex = indexById.get(expense.payerParticipantId);
    if (payerIndex != null) {
      balances[payerIndex].paidAmount += normalizeAmount(expense.amount);
    }

    const splitIds = normalizeSplitIds(
      expense.splitParticipantIds ?? participants.map((participant) => participant.id),
      indexById,
    );
    if (splitIds.length === 0) {
      continue;
    }

    const shares = splitAmount(normalizeAmount(expense.amount), splitIds.length);
    splitIds.forEach((participantId, splitIndex) => {
      const balanceIndex = indexById.get(participantId);
      if (balanceIndex != null) {
        balances[balanceIndex].shareAmount += shares[splitIndex];
      }
    });
  }

  return balances.map((balance) => ({ ...balance, netAmount: balance.paidAmount - balance.shareAmount }));
}

export function suggestSettlementTransfers(balances: SettlementBalance[]): SettlementTransfer[] {
  const orderByParticipantId = new Map(balances.map((balance, index) => [balance.participantId, index]));
  const creditors = balances
    .filter((balance) => balance.netAmount > 0)
    .map((balance) => ({ balance, remaining: normalizeAmount(balance.netAmount) }))
    .sort((left, right) =>
      compareByAmountThenOrder(right.remaining, left.remaining, left.balance, right.balance, orderByParticipantId),
    );
  const debtors = balances
    .filter((balance) => balance.netAmount < 0)
    .map((balance) => ({ balance, remaining: normalizeAmount(Math.abs(balance.netAmount)) }))
    .sort((left, right) =>
      compareByAmountThenOrder(right.remaining, left.remaining, left.balance, right.balance, orderByParticipantId),
    );

  const transfers: SettlementTransfer[] = [];
  let debtorIndex = 0;
  let creditorIndex = 0;

  while (debtorIndex < debtors.length && creditorIndex < creditors.length) {
    const debtor = debtors[debtorIndex];
    const creditor = creditors[creditorIndex];
    const amount = Math.min(debtor.remaining, creditor.remaining);

    if (amount > 0) {
      transfers.push({
        amount,
        fromName: debtor.balance.name,
        fromParticipantId: debtor.balance.participantId,
        toName: creditor.balance.name,
        toParticipantId: creditor.balance.participantId,
      });
    }

    debtor.remaining -= amount;
    creditor.remaining -= amount;

    if (debtor.remaining === 0) {
      debtorIndex += 1;
    }
    if (creditor.remaining === 0) {
      creditorIndex += 1;
    }
  }

  return transfers;
}

function normalizeAmount(amount: number): number {
  return Math.round(amount);
}

function normalizeSplitIds(participantIds: string[], indexById: Map<string, number>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];

  for (const participantId of participantIds) {
    if (indexById.has(participantId) && !seen.has(participantId)) {
      seen.add(participantId);
      out.push(participantId);
    }
  }

  return out;
}

function splitAmount(amount: number, count: number): number[] {
  const base = Math.floor(amount / count);
  const remainder = amount - base * count;
  return Array.from({ length: count }, (_, index) => base + (index < remainder ? 1 : 0));
}

function compareByAmountThenOrder(
  rightAmount: number,
  leftAmount: number,
  left: SettlementBalance,
  right: SettlementBalance,
  orderByParticipantId: Map<string, number>,
): number {
  const amountDiff = rightAmount - leftAmount;
  if (amountDiff !== 0) {
    return amountDiff;
  }

  return (orderByParticipantId.get(left.participantId) ?? 0) - (orderByParticipantId.get(right.participantId) ?? 0);
}
