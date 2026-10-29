async function runTests() {
  const base = 'http://localhost:3000';

  console.log('--- 1. Testing GET /api/state ---');
  let res = await fetch(`${base}/api/state`);
  let state = await res.json();
  console.log('Voting Open:', state.votingOpen);
  console.log('Race Title:', state.raceTitle);
  console.log('Total Drivers:', state.drivers.length);

  console.log('\n--- 2. Testing Vote when Closed (Expect 403) ---');
  let voteRes = await fetch(`${base}/api/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ driverId: '3', voterToken: 'user_a' })
  });
  let voteData = await voteRes.json();
  console.log('Status code:', voteRes.status, 'Message:', voteData.message);

  console.log('\n--- 3. Testing Admin Login ---');
  let loginRes = await fetch(`${base}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'f126admin' })
  });
  let loginData = await loginRes.json();
  console.log('Login success:', loginData.success);

  console.log('\n--- 4. Toggle Votes to OPEN via Admin ---');
  let toggleRes = await fetch(`${base}/api/admin/toggle-votes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-password': 'f126admin' }
  });
  let toggleData = await toggleRes.json();
  console.log('Votes Open now:', toggleData.votingOpen, 'Msg:', toggleData.message);

  console.log('\n--- 5. Add custom driver via Admin ---');
  let addRes = await fetch(`${base}/api/admin/driver`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-password': 'f126admin' },
    body: JSON.stringify({
      name: 'Ayrton Senna',
      number: 12,
      team: 'McLaren Classic',
      color: '#FF8000',
      code: 'SEN'
    })
  });
  let addData = await addRes.json();
  console.log('Driver added:', addData.driver.name, 'ID:', addData.driver.id);

  console.log('\n--- 6. Cast Vote for Driver ---');
  let castVoteRes = await fetch(`${base}/api/vote`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ driverId: addData.driver.id, voterToken: 'user_a' })
  });
  let castVoteData = await castVoteRes.json();
  console.log('Vote result:', castVoteData.message);

  console.log('\n--- 7. Fetch updated state & ranking ---');
  let stateRes2 = await fetch(`${base}/api/state?token=user_a`);
  let state2 = await stateRes2.json();
  console.log('Total votes:', state2.totalVotes);
  console.log('User voted for:', state2.userVote);
  console.log('Top driver in ranking:', state2.ranking[0].name, 'Percentage:', state2.ranking[0].percentage + '%');

  console.log('\n--- 8. Reset state back to closed and standard grid ---');
  await fetch(`${base}/api/admin/reset-votes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-password': 'f126admin' }
  });
  await fetch(`${base}/api/admin/toggle-votes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-password': 'f126admin' }
  });
  await fetch(`${base}/api/admin/load-preset`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-admin-password': 'f126admin' },
    body: JSON.stringify({ clearVotes: true })
  });
  let finalState = await (await fetch(`${base}/api/state`)).json();
  console.log('Final state clean reset -> Voting Open:', finalState.votingOpen, 'Drivers:', finalState.drivers.length);
}

runTests().catch(console.error);
