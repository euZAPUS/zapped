// C vocabulary in the spirit of the 42 curriculum: libft, get_next_line, printf,
// the Norm and the compiler flags every project is graded with.
export const c42Words: string[] = `
ft_strlen ft_strlcpy ft_strlcat ft_strchr ft_strrchr ft_strncmp ft_strnstr ft_strdup ft_substr ft_strjoin ft_strtrim
ft_split ft_itoa ft_atoi ft_strmapi ft_striteri ft_putchar_fd ft_putstr_fd ft_putendl_fd ft_putnbr_fd
ft_memset ft_bzero ft_memcpy ft_memmove ft_memchr ft_memcmp ft_calloc ft_isalpha ft_isdigit ft_isalnum ft_isascii
ft_isprint ft_toupper ft_tolower ft_lstnew ft_lstadd_front ft_lstadd_back ft_lstsize ft_lstlast ft_lstdelone
ft_lstclear ft_lstiter ft_lstmap ft_printf ft_putchar ft_putstr ft_putnbr get_next_line ft_strcmp ft_swap
malloc free calloc realloc open close read write printf fprintf sprintf snprintf perror strerror exit
fork wait waitpid pipe dup dup2 execve access unlink opendir readdir closedir signal sigaction kill
pthread_create pthread_join pthread_mutex_lock pthread_mutex_unlock usleep gettimeofday
mlx_init mlx_new_window mlx_pixel_put mlx_loop mlx_hook mlx_new_image mlx_get_data_addr mlx_destroy_window
#include #define #ifndef #endif <stdio.h> <stdlib.h> <unistd.h> <string.h> <stdarg.h> <fcntl.h> <limits.h>
size_t ssize_t unsigned int char long void const static struct typedef enum union sizeof
while for if else return break continue NULL EOF BUFFER_SIZE INT_MAX INT_MIN
argc argv **argv *str str[i] i++ ++i *ptr &var ->next ->content
t_list t_stack t_data t_philo t_node t_vec2 t_map t_player
`.split(/\s+/).filter(Boolean);

// Snippets and commands typed as a unit (they expand into several words).
export const c42Phrases: string[] = [
  'int main(void)',
  'int main(int argc, char **argv)',
  'while (str[i]) { i++; }',
  'if (!ptr) return (NULL);',
  'return (EXIT_SUCCESS);',
  'cc -Wall -Wextra -Werror',
  'cc -Wall -Wextra -Werror -g3 -fsanitize=address',
  'gcc -Wall -Wextra -Werror main.c -o a.out',
  'make re',
  'make fclean',
  'make all',
  'valgrind --leak-check=full ./a.out',
  'norminette -R CheckForbiddenSourceHeader',
  'git add .',
  'git commit -m',
];
