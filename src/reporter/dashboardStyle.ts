export const dashboardStyle = `
:root{color-scheme:dark;font:15px/1.5 system-ui,sans-serif;background:#0b1020;color:#dae1f4}
*{box-sizing:border-box}body{margin:0}main{max-width:1450px;margin:auto;padding:38px 30px}
h1{font-size:40px;letter-spacing:-1.5px;margin:4px 0}h2{font-size:22px;margin:0 0 16px}
h3{font-size:15px;margin:0 0 10px}.muted,small{color:#9caac9}header{margin-bottom:28px}
.eyebrow{color:#9e93ff;text-transform:uppercase;letter-spacing:3px;font-size:12px}
nav{display:flex;gap:12px;flex-wrap:wrap;margin:20px 0}a{color:#b5acff}
section{background:#121a2c;border:1px solid #26314b;border-radius:16px;padding:24px;margin:20px 0}
.metrics,.heatmap,.evidence{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:12px}
.metric,.tile,article{border:1px solid #303d5b;border-radius:10px;padding:16px;background:#182238}
.metric strong{font-size:30px;display:block;color:#c4bcff}.tile.hot{border-left:5px solid #fb8e82}
.tile.cool{border-left:5px solid #7de2c3}.badge{display:inline-block;padding:4px 9px;margin:3px;border-radius:7px;background:#302c51;color:#c6beff}
input,button{font:inherit;border-radius:8px;border:1px solid #4d5f84;background:#19243c;color:#edf1fc;padding:10px 15px}
input{width:min(450px,100%)}button{cursor:pointer}button:hover{background:#303761}
pre{white-space:pre-wrap;overflow-wrap:anywhere;font:12px/1.6 ui-monospace,monospace;background:#0b1223;padding:14px;border-radius:8px}
summary{cursor:pointer;color:#c6beff}table{border-collapse:collapse;width:100%}td,th{text-align:left;border-bottom:1px solid #303d5b;padding:10px}
.graph{overflow:auto;min-height:150px}.graph svg{max-width:none!important;width:100%;min-width:600px}
[hidden]{display:none!important}footer{margin-top:24px;color:#9caac9}@media(max-width:650px){main{padding:22px 14px}section{padding:16px}h1{font-size:30px}}
`;
