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
                        <button type="button" class="inner-button" id="btn-header-pause-all" data-header-action="pause-all" title="Tạm dừng tất cả các tệp">
                            <i class="fa-solid fa-pause"></i> <span>Tạm dừng tất cả</span>
                        </button>
                        <button type="button" class="inner-button btn-warning" id="btn-header-cancel-all" data-header-action="cancel-all" title="Hủy tất cả các tệp đang tải">
                            <i class="fa-solid fa-ban"></i> <span>Hủy tất cả</span>
                        </button>
                        <button type="button" class="inner-button btn-danger" id="btn-header-delete-all" data-header-action="delete-all" title="Xóa tất cả các tác vụ khỏi danh sách">
                            <i class="fa-solid fa-trash"></i> <span>Xóa tất cả</span>
                        </button>
                        <button type="button" class="inner-button btn-icon" title="Cài đặt"><i class="fa-solid fa-gear"></i></button>
                        <button type="button" class="inner-button-menu" title="Menu"><i class="fa-solid fa-bars"></i></button>
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
                        <a class="active" href="#" data-filter="home">
                            <i class="fa-solid fa-house"></i> Trang chủ
                        </a>
                    </li>
                    <li>
                        <a href="#" data-filter="all">
                            <i class="fa-solid fa-layer-group"></i> Tất cả
                        </a>
                    </li>
                    <li>
                        <a href="#" data-filter="downloading">
                            <i class="fa-solid fa-spinner"></i> Đang tải
                        </a>
                    </li>
                    <li>
                        <a href="#" data-filter="completed">
                            <i class="fa-solid fa-circle-check"></i> Đã hoàn thành
                        </a>
                    </li>
                    <li>
                        <a href="#" data-filter="audio">
                            <i class="fa-solid fa-music"></i> Âm thanh
                        </a>
                    </li>
                    <li>
                        <a href="#" data-filter="video">
                            <i class="fa-solid fa-video"></i> Video
                        </a>
                    </li>
                    <li>
                        <a href="#" data-filter="document">
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