import { useState } from 'react';

function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="app">
      <h1>디어쌤 - 학원 관리</h1>
      <div className="card">
        <button onClick={() => setCount((count) => count + 1)}>
          count is {count}
        </button>
        <p>
          환경설정이 완료되었습니다.
        </p>
      </div>
    </div>
  );
}

export default App;

