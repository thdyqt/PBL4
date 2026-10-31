using System;
using System.Collections.Generic;
using System.Linq;
using System.Net;
using System.Threading.Tasks;
using System.Windows.Forms;

namespace WindowsFormsApp
{
    internal static class Program
    {
        /// <summary>
        /// The main entry point for the application.
        /// </summary>
        [STAThread]
        static void Main(string[] args)
        {
            // .NET Framework mặc định chỉ cho 2 kết nối đồng thời tới cùng một máy chủ.
            // Không nâng giới hạn này thì 16 luồng tải thực chất vẫn chỉ chạy 2 luồng.
            ServicePointManager.DefaultConnectionLimit = 64;
            ServicePointManager.SecurityProtocol |= SecurityProtocolType.Tls12;

            Application.EnableVisualStyles();
            Application.SetCompatibleTextRenderingDefault(false);

            bool startInBackground = WindowsFormsApp.Download.ShellIntegrationHelper.HasBackgroundArg(args) ||
                                     WindowsFormsApp.Download.ShellIntegrationHelper.HasBackgroundArg(Environment.GetCommandLineArgs());

            Application.Run(new Form1(startInBackground));
        }
    }
}
