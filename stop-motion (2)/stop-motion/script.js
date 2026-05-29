// Aguarda o site carregar e inicia a contagem de cinema
document.addEventListener("DOMContentLoaded", () => {
    const countdownText = document.getElementById("countdown-text");
    const countdownScreen = document.getElementById("countdown-screen");
    const mainSite = document.getElementById("main-site");

    // Passo 1: Começa em LUZ... (já definido no HTML)

    // Passo 2: Muda para CÂMERA... após 1.2 segundos
    setTimeout(() => {
        countdownText.innerText = "CÂMERA...";
    }, 1200);

    // Passo 3: Muda para ANIMAÇÃO! após 2.4 segundos
    setTimeout(() => {
        countdownText.innerText = "ANIMAÇÃO!";
        countdownText.style.color = "#ff9d00"; // Ganha cor no momento final!
    }, 2400);

    // Passo 4: Some com a contagem e revela o site colorido após 3.8 segundos
    setTimeout(() => {
        countdownScreen.style.opacity = "0";
        countdownScreen.style.visibility = "hidden";
        mainSite.classList.remove("hidden");
    }, 3800);
});

// Função para fazer a página rolar suavemente até o conteúdo ao clicar no botão
function scrollToContent() {
    const contentSection = document.getElementById("content-section");
    contentSection.scrollIntoView({ behavior: "smooth" });
}
