const canvas = document.querySelector<HTMLCanvasElement>("#game")!;
const ctx = canvas.getContext("2d")!;
canvas.width = innerWidth;
canvas.height = innerHeight;
ctx.fillStyle = "#fff";
ctx.font = "24px sans-serif";
ctx.fillText("herd", 20, 40);
