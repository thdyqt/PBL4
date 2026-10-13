// Khởi tạo AOS
AOS.init();

// Bật tắt Sidebar
document.addEventListener("click", (e) => {
    const btnMenu = e.target.closest(".inner-button-menu");
    const overlay = e.target.closest(".sider-overlay");
    
    const sider = document.querySelector(".sider");
    const siderOverlay = document.querySelector(".sider-overlay");

    if (btnMenu && sider && siderOverlay) {
        sider.classList.toggle("active");
        siderOverlay.classList.toggle("active");
    } 

    else if (overlay && sider && siderOverlay) {
        sider.classList.remove("active");
        siderOverlay.classList.remove("active");
    }
});