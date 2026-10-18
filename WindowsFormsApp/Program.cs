using System;
using System.Net;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace WindowsFormsApp
{
    internal static class Program
    {
        /// <summary>
        /// The main entry point for the application.
        [STAThread]
        static void Main()
        {
            // .NET Framework mặc định chỉ cho 2 kết nối/máy chủ. Phải đặt TRƯỚC khi gửi request đầu tiên.
            ServicePointManager.DefaultConnectionLimit = 64;

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);
            Application.Run(new Form1());
        }
    }
}
