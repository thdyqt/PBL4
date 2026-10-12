// Khởi tạo AOS
AOS.init();

// Bật tắt Sidebar thông minh bằng Event Delegation
document.addEventListener("click", (e) => {
    const btnMenu = e.target.closest(".inner-button-menu");
    const overlay = e.target.closest(".sider-overlay");
    
    const sider = document.querySelector(".sider");
    const siderOverlay = document.querySelector(".sider-overlay");

    // Nếu bấm vào nút Menu Hamburger
    if (btnMenu && sider && siderOverlay) {
        sider.classList.toggle("active");
        siderOverlay.classList.toggle("active");
    } 
    // Nếu bấm ra ngoài màn hình mờ (Overlay)
    else if (overlay && sider && siderOverlay) {
        sider.classList.remove("active");
        siderOverlay.classList.remove("active");
    }
});