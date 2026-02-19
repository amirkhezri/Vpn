// درخواست trial از backend
async function requestTrial(telegramId) {
  const res = await fetch("/api/trial", {
    method: "POST",
    headers: {"Content-Type":"application/json"},
    body: JSON.stringify({ telegramId })
  });

  return res.json();
}
