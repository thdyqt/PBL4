class SocialContact extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
            <nav class="box-contact">
                <ul>
                    <li>
                        <a href="https://www.facebook.com/thdyqt" target="blank">
                            <i class="fa-brands fa-facebook"></i>
                        </a>
                    </li>
                    <li>
                        <a href="https://www.instagram.com/thdyqt" target="blank">
                            <i class="fa-brands fa-instagram"></i>
                        </a>
                    </li>
                    <li>
                        <a href="https://www.tiktok.com/@thdyqt" target="blank">
                            <i class="fa-brands fa-tiktok"></i>
                        </a>
                    </li>
                    <li>
                        <a href="https://www.youtube.com/@duyphan7401" target="blank">
                            <i class="fa-brands fa-youtube"></i>
                        </a>
                    </li>
                </ul>
            </nav>
        `;
    }
}

customElements.define('social-contact', SocialContact);

class Header extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
            <header class="header">
                <div class="inner-wrap">
                    <div class="inner-brand">
                        <img src="../images/Logo.png" alt="Logo">
                        <div class="inner-title">
                            <h1>DUT Download Accelerator</h1>
                            <div>PBL4 - Hệ thống tăng tốc tải về</div>
                        </div>
                    </div>
                    <div class="inner-button-list">
                        <button class="inner-button btn-resume"><i class="fa-solid fa-play"></i> Tiếp tục</button>
                        <button class="inner-button"><i class="fa-solid fa-pause"></i> Tạm dừng</button>
                        <button class="inner-button btn-danger"><i class="fa-solid fa-trash"></i> Xóa</button>
                        <button class="inner-button btn-icon"><i class="fa-solid fa-gear"></i></button>
                        <button class="inner-button-menu"><i class="fa-solid fa-bars"></i></button>
                    </div>
                </div>
            </header>
        `;
    }
}

customElements.define('app-header', Header);

class Sider extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
            <nav class="sider">
                <div class="inner-menu-title">DANH MỤC</div>
                <ul class="inner-menu">
                    <li>
                        <a class="active" href="#">
                            <i class="fa-solid fa-house"></i> Trang chủ
                        </a>
                    </li>
                    <li>
                        <a href="#">
                            <i class="fa-solid fa-layer-group"></i> Tất cả
                        </a>
                    </li>
                    <li>
                        <a href="#">
                            <i class="fa-solid fa-spinner"></i> Đang tải
                        </a>
                    </li>
                    <li>
                        <a href="#">
                            <i class="fa-solid fa-circle-check"></i> Đã hoàn thành
                        </a>
                    </li>
                    <li>
                        <a href="#">
                            <i class="fa-solid fa-music"></i> Âm thanh
                        </a>
                    </li>
                    <li>
                        <a href="#">
                            <i class="fa-solid fa-video"></i> Video
                        </a>
                    </li>
                    <li>
                        <a href="#">
                            <i class="fa-solid fa-file-zipper"></i> Nén / Tài liệu
                        </a>
                    </li>
                </ul>
            </nav>
            <div class="sider-overlay"></div>
        `;
    }
}
customElements.define('app-sider', Sider);